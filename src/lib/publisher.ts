import { WritableAsync, WritableAsyncOptions, pipeline } from '@pieropatron/stream-async';
import { Readable } from 'stream';
import { API, BASIC_PROPERTIES, BASIC_RETURN, BASIC_ACK, METHODS } from '../proto/api';
import { writeBodyOne } from '../proto/codec';
import { ChannelChildAbstract, Connection, Response } from './channel';
import { CloseErrorBase } from './errors';

class ChannelPublish extends ChannelChildAbstract {
	private _stream: PublishStream;

	constructor(connection: Connection, channel: number){
		super(connection, channel);
		this.handlers
			// dummy ignore ack (when it received after basic_return)
			.set(METHODS.basic_ack, async ()=>{})
			;
	}

	handle_body(): void {
		// it possible to get content back on return, so just ignore it (noop)
	}

	handle_header(): void {
		// it possible to get content back on return, so just ignore it (noop)
	}

	set_stream(stream: PublishStream){
		this._stream = stream;
	}

	destroy(error?: Error | null | undefined): void {
		if (this._stream){
			this._stream.destroy(error || undefined);
		}
		super.destroy(error);
	}

	async confirm(){
		return this.call_api([METHODS.confirm_select_ok], async ()=>{
			API.confirm_select(this.socket, this.channel, {	nowait: false });
		});
	}
}

type PublishCallback = (error?: Error | null, result?: BASIC_ACK) => void;

type PublishMessageCommon = {
	properties?: BASIC_PROPERTIES,
	exchange?: string,
	routing_key?: string,
	callback?: PublishCallback
}

export type PublishMessage = ({ body?: Readable, body_size: number } & PublishMessageCommon) | ({ body?: Buffer, body_size?: undefined } & PublishMessageCommon);

type PublishStreamOptions = Pick<WritableAsyncOptions<PublishMessage>, "highWaterMark">;

class BodyStream extends WritableAsync<Buffer> {
	protected _channel: ChannelPublish;
	constructor(channel: ChannelPublish, options: PublishStreamOptions){
		super(options);
		this._channel = channel;
	}

	async _writeAsync(chunk: Buffer): Promise<void> {
		return writeBodyOne(this._channel.socket, this._channel.channel, chunk);
	}
}

export class PublishStream extends WritableAsync<PublishMessage> {
	private _connection: Connection;
	private _publish: (chunk: PublishMessage)=>Promise<void>;
	private _channel: ChannelPublish;

	constructor(connection: Connection, options: Partial<PublishStreamOptions> = {}){
		const _options: WritableAsyncOptions<PublishMessage> = {
			...options,
			objectMode: true
		};
		super(_options);
		Object.defineProperty(this, '_connection', { value: connection});
		this._publish = this._init;
	}

	get frame_max(){
		return this._connection.options.frame_max;
	}

	protected async _check_publish_response(response: Response, callback: PublishCallback){
		if (response.method_id === METHODS.basic_return) {
			const nack: BASIC_RETURN = response.args;
			return callback(new CloseErrorBase(METHODS.basic_publish, nack.reply_code, nack.reply_text, { routing_key: nack.routing_key, exchange: nack.exchange }));
		}

		return callback(null, response.args);
	}

	protected async _publish_api_common(chunk: PublishMessage) {
		if (chunk.properties){
			const priority = chunk.properties.priority;
			if ((priority !== undefined) && (priority < 0 || priority > 9)){
				throw new Error(`Invalid priority value [${priority}]`);
			}
		}
		await API.basic_publish(this._channel.socket, this._channel.channel, {
			exchange: chunk.exchange || "",
			routing_key: chunk.routing_key || "",
			immediate: false,
			mandatory: true
		});
		await API.publish_header(this._channel.socket, this._channel.channel, chunk.properties || {}, chunk.body_size || 0);
	}

	protected async _publish_header_only(chunk: PublishMessage, callback: PublishCallback){
		const response: Response = await this._channel.call_api([METHODS.basic_return, METHODS.basic_ack], async ()=>{
			await this._publish_api_common(chunk);
		}) as any;
		return this._check_publish_response(response, callback);
	}

	protected async _publish_readable(chunk: PublishMessage, callback: PublishCallback){
		const response: Response = await this._channel.call_api([METHODS.basic_return, METHODS.basic_ack], async () => {
			await this._publish_api_common(chunk);
			await pipeline(chunk.body as Readable, new BodyStream(this._channel, { highWaterMark: this.frame_max }));
		}) as any;

		return this._check_publish_response(response, callback);
	}

	protected async _publish_chunk(chunk: PublishMessage){
		const callback = chunk.callback || ((error?: null | Error)=>{
			if (error){
				this.emit('error', error);
			}
		});

		if (chunk.body instanceof Readable) {
			if (chunk.body_size === undefined) {
				throw new Error(`body_size required for streamable message`);
			}
			return this._publish_readable(chunk, callback);
		} else if (chunk.body instanceof Buffer) {
			if (!chunk.body.length){
				return this._publish_header_only(chunk, callback);
			}

			const body = new Readable({
				objectMode: false,
				highWaterMark: this.frame_max,
				read(){}
			});
			body.push(chunk.body);
			chunk.body_size = chunk.body.length;
			body.push(null);
			chunk.body = body;
			return this._publish_readable(chunk, callback);
		} else if (!chunk.body) {
			return this._publish_header_only(chunk, callback);
		} else {
			throw new Error(`Invalid body`);
		}
	}

	protected async _init(chunk: PublishMessage){
		const channel = this._channel = await this._connection.channel_open(ChannelPublish);
		channel.set_stream(this);
		await channel.confirm();
		this._publish = this._publish_chunk;
		return this._publish(chunk);
	}

	async _writeAsync(chunk: PublishMessage): Promise<void> {
		return this._publish(chunk);
	}

	async _destroyAsync(error?: Error | null) {
		if (!this._connection.destroyed){
			this._connection.destroy(error);
		}
	}
}
