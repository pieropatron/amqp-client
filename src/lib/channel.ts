import { Socket } from 'net';
import { pipeline } from 'stream';
import { WritableAsync } from '@pieropatron/stream-async';
import {
	BASIC_PROPERTIES, METHODS_NAMES, DECODERS, METHODS, API,
	CONNECTION_START, CONNECTION_TUNE, CONNECTION_TUNE_OK, CONNECTION_UPDATE_SECRET, CONNECTION_CLOSE, CHANNEL_FLOW, CHANNEL_CLOSE
} from 'proto/api';
import { ENCODING, BufferReader, EMPTY_FRAME_SIZE } from 'proto/codec';
import { FRAME_TYPES, FRAME_CONST } from 'proto/constant';
import { HardError, BASIC_PROPERTIES_METHOD, ErrorToClose, CloseErrorBase } from './errors';
import { SASL_MECHANISM, IMechanism } from './sasl';
import * as PACKAGE from '../../package.json';
import { DATE_CONST, CloneObject } from './utils';
import { BufferWriter, writeSocket } from 'proto/codec';

type Callback = (error?: Error | null, result?: any)=>void;

class UniqueId {
	time = Date.now();
	sequence = 0;

	compare(id: UniqueId){
		const time_diff = this.time - id.time;
		if (time_diff){
			return time_diff;
		} else {
			return (this.sequence - id.sequence);
		}
	}
}

const UniqueFactory = {
	last_id: new UniqueId(),

	generate(){
		const id = new UniqueId();
		if (id.time === this.last_id.time) {
			id.sequence = this.last_id.sequence + 1;
		}
		return id;
	}
};

export type Response = { method_id: number, args: any };

abstract class ChannelAbstract {
	abstract readonly socket: Socket;

	readonly channel: number;
	protected request_callbacks = new Map<number, Map<UniqueId, Callback>>();
	protected handlers = new Map<number, (args: any)=>Promise<void>>();
	destroyed = false;
	closed = false;

	constructor(channel: number){
		this.channel = channel;
	}

	abstract fatal(error: Error, data?: any): void;

	async call_api(responses: number[], send: ()=>Promise<void>){
		if (!responses.length){
			return send();
		}

		let id: UniqueId;
		const clear = ()=>{
			for (const method_id of responses){
				const callbacks =  this.request_callbacks.get(method_id) as Map<UniqueId, Callback>;
				callbacks.delete(id);
			}
		};

		let called = false;

		return new Promise<Response>((resolve, reject)=>{
			process.nextTick(()=>{
				id = UniqueFactory.generate();
				const callback: Callback = (error, result: Response)=>{
					if (called) return;
					called = true;
					clear();
					if (error) return reject(error);
					return resolve(result);
				};

				for (const method_id of responses) {
					let callbacks = this.request_callbacks.get(method_id);
					if (callbacks === undefined){
						callbacks = new Map();
						this.request_callbacks.set(method_id, callbacks);
					}
					callbacks.set(id, callback);
				}

				send().catch((error)=>callback(error));
			});
		});
	}

	destroy(error?: Error | null){
		if (!this.socket.destroyed && !this.destroyed) {
			this.call_close(error).catch(e=>{
				this.fatal(e, 'destroy.call_close');
			});
		}
		const reject_error: Error = error || new HardError(0, 'connection_forced', 'Channel or connection closed');
		for (const [, callback_map] of this.request_callbacks){
			for (const [, callback] of callback_map){
				callback(reject_error);
			}
		}
	}

	abstract call_close(error?: Error | null): Promise<void>;

	handle_method(method_id: number, args: any){
		process.nextTick(()=>{
			if (this.destroyed){
				return;
			}
			const callbacks = this.request_callbacks.get(method_id);
			if (callbacks && callbacks.size){
				let callback: Callback;
				if (callbacks.size === 1){
					callback = Array.from(callbacks.values())[0];
				} else {
					const keys = Array.from(callbacks.keys()).sort();
					callback = callbacks.get(keys[0]) as Callback;
				}
				callback(null, { method_id, args });
				return;
			}

			const handler = this.handlers.get(method_id);
			if (handler === undefined){
				return this.fatal(new Error(`Handler for ${METHODS_NAMES[method_id] || "unknown method"} [${method_id}] not found!`));
			}

			handler(args).catch(this.fatal);
		});
	}

	abstract handle_header(body_size: bigint, propterties: BASIC_PROPERTIES): void;
	abstract handle_body(body: Buffer): void;
	abstract handle_heartbeat(): void;

	async close(){
		await this.call_close();
		this.destroy();
	}
}

function decodeProtocolHeader(buffer: Buffer) {
	return {
		protocol: buffer.toString(ENCODING, 0, 4),
		major: buffer[5],
		minor: buffer[6],
		revision: buffer[7]
	};
}

class DecodeStream extends WritableAsync<Buffer>{
	private cache?: Buffer;
	private decode: (buffer: Buffer) => void;
	private connection: Connection;

	constructor(connection: Connection) {
		super({ objectMode: false });
		this.decode = this._init;
		this.connection = connection;
	}

	private _init(buffer: Buffer) {
		if (buffer.length === 8) {
			const data = decodeProtocolHeader(buffer);
			throw new HardError(METHODS.connection_start, 'not_implemented', 'Protocol version not supported', data);
		}

		this.decode = this._decode;
		return this._decode(buffer);
	}

	private _decodeframestart(reader: BufferReader) {
		const frame_type = reader.uint8('frame_type');
		const channel = reader.uint16("channel");
		const size = reader.uint32("frame_size");
		return { frame_type, channel, size };
	}

	private _decode(buffer: Buffer) {
		const reader = new BufferReader(buffer);
		let frame_start = this._decodeframestart(reader);
		while ((frame_start.size + 1 + reader.offset) <= buffer.length) {
			const end = buffer.readUInt8(frame_start.size + reader.offset);
			if (end !== FRAME_CONST.frame_end) {
				throw new RangeError(`Invalid frame end [${end}]`);
			}

			const channel = frame_start.channel === 0 ? this.connection : this.connection.channels.get(frame_start.channel);
			if (channel === undefined) {
				throw new HardError(0, 'channel_error', `Unknown channel`, frame_start);
			}
			if (frame_start.frame_type === FRAME_TYPES.frame_method) {
				const method_id = reader.uint32("method_id");
				const decoder = DECODERS.get(method_id);
				if (decoder === undefined) {
					throw new HardError(method_id, 'frame_error', "Unknown method_id", frame_start);
				}
				let args: any;
				try {
					args = decoder(reader, "arguments");
				} catch (e) {
					throw new HardError(method_id, 'frame_error', `Decode arguments error`, {
						path: reader.current_path,
						offset: reader.offset,
						buffer
					});
				}
				channel.handle_method(method_id, args);
			} else if (frame_start.frame_type === FRAME_TYPES.frame_body) {
				const body = reader.body(frame_start.size);
				channel.handle_body(body);
			} else if (frame_start.frame_type === FRAME_TYPES.frame_header) {
				const class_id = reader.uint16("class_id");
				const decoder = DECODERS.get(class_id);
				if (decoder === undefined) {
					throw new HardError(class_id << 16, 'frame_error', 'Unknown header class_id', { ...frame_start, class_id });
				}
				reader.skip(2);
				const body_size = reader.uint64('body_length');
				let properties: any;
				try {
					properties = decoder(reader, "properties");
				} catch (e) {
					throw new HardError(BASIC_PROPERTIES_METHOD, 'frame_error', `Decode properties error`, {
						path: reader.current_path,
						offset: reader.offset,
						buffer
					});
				}
				channel.handle_header(body_size, properties);
			} else if (frame_start.frame_type === FRAME_TYPES.frame_heartbeat) {
				channel.handle_heartbeat();
			} else {
				throw new HardError(0, 'frame_error', `Unknown frame type`, frame_start);
			}

			// end already checked above
			reader.skip(1);

			const unread = (buffer.length - reader.offset);
			if (unread < EMPTY_FRAME_SIZE) {
				if (unread) {
					this.cache = buffer.subarray(reader.offset);
				}
				return;
			}

			frame_start = this._decodeframestart(reader);
		}

		if (buffer.length === reader.offset) {
			this.cache = buffer.subarray(reader.offset);
		}
	}

	async _writevAsync(chunks: {chunk: Buffer}[]) {
		this.connection.heartbeat = Date.now();
		const buffers = chunks.map(chunk => chunk.chunk);
		if (this.cache) buffers.unshift(this.cache);
		delete this.cache;
		const buffer = Buffer.concat(buffers);

		if (buffer.length < EMPTY_FRAME_SIZE) {
			this.cache = buffer;
			return;
		}
		return this.decode(buffer);
	}
}

export type ConnectionOptions = {
	/** Supported protocol */
	protocol: string,
	/** User name for authenticate */
	username: string,
	/** Password for authenticate */
	password: string,
	/** Server host */
	host: string,
	/** Server port */
	port: number,
	/** Virtual host */
	vhost: string,
	/** Authentication mechanism list */
	auth_mechanism: Array<keyof typeof SASL_MECHANISM>,
	/** Heartbeat timeout in seconds */
	heartbeat: number,
	/** Connection timeout in ms */
	connection_timeout: number,
	/** Channel max number */
	channel_max: number,
	/** Connection locale */
	locale: string,
	/** Max size of frame (for content) */
	frame_max: number
};

/**
 * Get margin of error for heartbeat timeout
 * @param heartbeat for margin
 * @returns
 */
function getHeartbeatMarginOfError(heartbeat: number) {
	return Math.min(Math.max(heartbeat / DATE_CONST.HB_MOF_DENOMINATOR, DATE_CONST.HB_MOF_MIN), DATE_CONST.HB_MOF_MAX);
}

const HEARTBEAT = new BufferWriter(EMPTY_FRAME_SIZE, false).heartbeat().buffer;

export class Connection extends ChannelAbstract {
	readonly socket: Socket;
	channels = new Map<number, ChannelChildAbstract>();
	heartbeat = Date.now();
	options: ConnectionOptions;
	/** Timeout for send hearbeats */
	protected _to_send_hb?: ReturnType<typeof setTimeout>;
	/** Interval for check heartbeats */
	protected _interval_ck_hb?: ReturnType<typeof setInterval>;
	opened = false;
	blocked = false;
	protected version: string;
	constructor(socket: Socket, options: ConnectionOptions, version: string){
		const auth_mechanism = options.auth_mechanism;
		for (const mechanism of auth_mechanism) {
			if (!SASL_MECHANISM[mechanism]) {
				throw new Error(`auth_mechanism ${mechanism} not supported`);
			}
		}
		super(0);
		this.socket = socket;
		this.options = CloneObject(options);
		this.version = version;
		this.handlers
			.set(METHODS.connection_blocked, async ()=>{
				this.blocked = true;
			})
			.set(METHODS.connection_unblocked, async ()=>{
				this.blocked = false;
			})
			.set(METHODS.connection_update_secret, async (data: CONNECTION_UPDATE_SECRET)=>{
				this.destroy(new HardError(METHODS.connection_update_secret, 'not_implemented', 'Unexpected update secret', data));
			})
			.set(METHODS.connection_close, async (data: CONNECTION_CLOSE)=>{
				await this.call_api([], async ()=>{
					API.connection_close_ok(this.socket);
				});
				this.destroy(new CloseErrorBase(data.method_id, data.reply_code, data.reply_text));
			})
			;

		pipeline(socket, new DecodeStream(this), (error)=>{
			if (this.destroyed) {
				return;
			}
			this.destroy(error);
		});
	}

	fatal(error: Error, data?: any){
		console.error('AMQP connection fatal:', error, data);
		process.exit(1);
	}

	handle_body(body: Buffer): void {
		this.destroy(new HardError(METHODS.basic_properties, 'unexpected_frame', 'Connection can not handle body', body));
	}

	handle_header(body_size: bigint, propterties: Partial<{ content_type: string; content_encoding: string; headers: object; delivery_mode: number; priority: number; correlation_id: string; reply_to: string; expiration: string; message_id: string; timestamp: Date; type: string; user_id: string; app_id: string; }>): void {
		this.destroy(new HardError(METHODS.basic_properties, 'unexpected_frame', 'Connection can not handle header', { body_size, propterties }));
	}

	handle_heartbeat(): void {
		this.heartbeat = Date.now();
	}

	async open(){
		const [version_major, version_minor, version_revision] = this.version.split(".").map(el=>parseInt(el));

		const proto_header = new BufferWriter(EMPTY_FRAME_SIZE, false);
		proto_header.jsstring("protocol", this.options.protocol.slice(0, 4).toUpperCase());
		proto_header.skip(1);
		proto_header.uint8("major", version_major);
		proto_header.uint8("minor", version_minor);
		proto_header.uint8("revision", version_revision);

		let response = await this.call_api([METHODS.connection_start], async ()=>{
			await writeSocket(this.socket, proto_header);
		}) as Response;

		const { args: server_props } = response as { args: CONNECTION_START };
		if (server_props.version_major < version_major || server_props.version_minor < version_minor){
			throw new HardError(METHODS.connection_start, 'not_implemented', "Version not supported", server_props);
		}

		const SET_MECHANISM = new Set<string>(server_props.mechanisms.split(" "));
		const { auth_mechanism, username, password } = this.options;
		const mechanism: string | undefined = auth_mechanism.find(mechanism => SET_MECHANISM.has(mechanism));
		if (!mechanism) {
			throw new HardError(METHODS.connection_start, 'not_allowed', `Server doesn't support auth_mechanism [${auth_mechanism.join(", ")}]`, server_props);
		}

		const sasl: IMechanism = SASL_MECHANISM[mechanism];

		response = await this.call_api([METHODS.connection_secure, METHODS.connection_tune], async ()=>{
			await API.connection_start_ok(this.socket, {
				client_properties: {
					capabilities: {
						authentication_failure_close: true,
						'connection.blocked': true,
						exchange_exchange_bindings: true,
						publisher_confirms: true,
						'basic.nack': true,
						consumer_cancel_notify: true,
						per_consumer_qos: true,
						consumer_priorities: true,
						direct_reply_to: true
					},
					platform: `Nodejs ${process.version}`,
					version: PACKAGE.version,
					product: PACKAGE.name,
					copyright: PACKAGE.author,
					connection_name: `Nodejs connection ${new Date().toISOString()}`
				},
				mechanism,
				response: sasl.encode(username, password),
				locale: this.options.locale
			});
		}) as Response;

		if (response.method_id === METHODS.connection_secure){
			throw new HardError(METHODS.connection_start_ok, 'connection_forced', 'Unexpected connection.secure', response.args);
		}

		const tune: CONNECTION_TUNE = response.args;
		const tune_ok: CONNECTION_TUNE_OK = { ...tune };
		const options = this.options;
		if (options.channel_max && options.channel_max < tune.channel_max) {
			tune_ok.channel_max = options.channel_max;
		} else {
			options.channel_max = tune.channel_max;
		}

		if (options.frame_max && options.frame_max < tune.frame_max) {
			tune_ok.frame_max = options.frame_max;
		} else {
			options.frame_max = tune.frame_max;
		}

		tune_ok.heartbeat = options.heartbeat;

		await this.call_api([], async ()=>{
			return API.connection_tune_ok(this.socket, tune_ok);
		});

		await this.call_api([METHODS.connection_open_ok], async ()=>{
			return API.connection_open(this.socket, {
				virtual_host: options.vhost
			});
		});

		if (tune.heartbeat) {
			this.start_send_heartbeat(tune.heartbeat);
		}

		if (options.heartbeat) {
			this.start_check_heartbeat();
		}
		this.opened = true;
	}

	/**
	 * Start to send heartbeats to peer
	 * @param heartbeat timeout of send
	 */
	protected start_send_heartbeat(heartbeat: number) {
		heartbeat = heartbeat * DATE_CONST.SECOND;

		// heartbeat margin of error
		const hb_mof = getHeartbeatMarginOfError(heartbeat);

		const _send = async () => {
			const time = Date.now();
			this.socket.write(HEARTBEAT);
			const time_send = (Date.now() - time);
			return heartbeat - time_send - hb_mof;
		};

		const _delay = async (delay: number) => {
			await new Promise(resolve => {
				this._to_send_hb = setTimeout(resolve, delay);
			});
			delete this._to_send_hb;
		};

		const _run = async () => {
			await _delay(heartbeat);
			while (!this.destroyed) {
				const delay = await _send();
				if ((delay > 0) && !this.destroyed) {
					await _delay(delay);
				}
			}
		};

		_run().catch(this.fatal);
	}

	/**
	 * Start checking if peer is active or not.
	 * As heartbeats serves for check if peer is active or not,
	 * it is more sense to check last datetime of every received information,
	 * but not only received heartbeats.
	 * This also should help to avoid unnessesary errors
	 * in case of connection is busy with processing of another frame types
	 */
	protected start_check_heartbeat() {
		const heartbeat = this.options.heartbeat * DATE_CONST.SECOND;
		const hb_mof = getHeartbeatMarginOfError(heartbeat);
		const max_delay = heartbeat + hb_mof;
		this._interval_ck_hb = setInterval(() => {
			const delay = (Date.now() - this.heartbeat);
			if (delay > max_delay) {
				return this.destroy(new HardError(0, 'connection_forced', 'Heartbeat timeout expired', {}));
			}
		}, DATE_CONST.HB_MOF_MAX);
	}

	destroy(error?: Error | null){
		if (this._to_send_hb) {
			clearTimeout(this._to_send_hb);
			delete this._to_send_hb;
		}

		if (this._interval_ck_hb) {
			clearInterval(this._interval_ck_hb);
			delete this._interval_ck_hb;
		}

		for (const key of this.channels.keys()){
			const channel = this.channels.get(key);
			channel?.destroy(error);
			this.channels.delete(key);
		}
		super.destroy(error);
		this.destroyed = true;
		if (!this.socket.destroyed){
			this.socket.destroy(error || undefined);
		}
	}

	async call_close(error?: Error | null): Promise<void> {
		if (this.destroyed || this.closed) return;
		await this.call_api([METHODS.connection_close_ok], async ()=>{
			return API.connection_close(this.socket, ErrorToClose(error));
		});
		this.closed = true;
	}

	async channel_open<T extends typeof ChannelChildAbstract>(child_class: T){
		// create new instance of ChannelChild and register channel in connection
		const channel = await new Promise<ChannelChildAbstract>((resolve, reject) => {
			process.nextTick(() => {
				if (!this.opened || this.destroyed || this.blocked) {
					return reject(new HardError(METHODS.channel_open, 'channel_error', "Connection inactive"));
				}

				if (this.channels.size === this.options.channel_max) {
					return reject(new HardError(METHODS.channel_open, 'channel_error', "Channel max limit exceeded"));
				}

				const ids = Array.from(this.channels.keys()).sort();
				let id = 1;
				if (ids.length) {
					const last_id = ids[ids.length - 1];
					if (last_id > ids.length) {
						// find "free" id;
						for (let i = last_id - 1; i > 0; i--) {
							if (!this.channels.get(i)) {
								id = i;
								break;
							}
						}
					} else {
						id = last_id + 1;
					}
				}

				const result = new (child_class as any)(this, id);
				this.channels.set(id, result);
				resolve(result);
			});
		});
		await channel.call_api([METHODS.channel_open_ok], async ()=>{
			await API.channel_open(this.socket, channel.channel);
			channel.flow = true;
		});
		return channel as InstanceType<T>;
	}
}

/**
 * Child channel abstract class
 * NB: Sending channel.flow from client has no sense, as server doesn't support active=false and channel is flowing by default
 * (see: https://www.rabbitmq.com/specification.html):
 * "active=false is not supported by the server. Limiting prefetch with basic.qos provides much better control."
 */
export abstract class ChannelChildAbstract extends ChannelAbstract {
	protected connection: Connection;
	flow = false;
	constructor(connection: Connection, channel: number){
		super(channel);
		this.connection = connection;
		this.handlers
			.set(METHODS.channel_flow, async (args: CHANNEL_FLOW)=>{
				this.flow = args.active;
				await this.call_api([], async ()=>{
					return API.channel_flow_ok(this.socket, this.channel, { active: this.flow });
				});
			})
			.set(METHODS.channel_close, async (args: CHANNEL_CLOSE)=>{
				await this.call_api([], async () => {
					return API.channel_close_ok(this.socket, this.channel);
				});
				this.destroy(new CloseErrorBase(args.method_id, args.reply_code, args.reply_text));
			})
			;
	}

	get socket(){ return this.connection.socket; }

	fatal(error: Error, data?: any): void {
		this.connection.fatal(error, data);
	}

	handle_heartbeat(): void {
		this.connection.destroy(new HardError(0, 'unexpected_frame', 'Channel can not handle heartbeat', {channel: this.channel}));
	}

	async call_close(error?: Error | null): Promise<void> {
		if (this.destroyed || this.closed) return;
		await this.call_api([METHODS.channel_close_ok], async () => {
			return API.channel_close(this.socket, this.channel, ErrorToClose(error));
		});
		this.closed = true;
	}

	destroy(error?: Error | null): void {
		super.destroy(error);
		this.destroyed = true;
		this.connection.channels.delete(this.channel);
	}
}

export type GetConnection = () => Promise<Connection>;
