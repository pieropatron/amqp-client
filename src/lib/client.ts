import { Socket } from 'net';
import { ConnectionOptions as TLSConnectionOptions, TLSSocket } from 'tls';
import { Connection as ConnectionInternal, ConnectionOptions as ConnectionOptionsInternal } from './channel';
import { PORT as AMQPort } from 'proto/constant';
import { MergeObjects } from './utils';
import { Queue, Exchange } from './commands';
import { PublishStream, PublishMessage } from './publisher';
import { ChannelConsume, ConsumerOptions } from './consumer';
import { ReadableAsync } from '@pieropatron/stream-async';
import { pipeline } from 'stream';

export type ConnectionOptionsAMQPS = {
	// value "verify_peer" means, that server should to check ceritificates of client
	verify: "verify_peer" | "verify_none",
	// option specifies the certificates of the root Certificate Authorities that we wish to implicitly trust.
	cacertfile: string,
	// is the client's own certificate in PEM format
	certfile: string,
	// is the client's private key file in PEM format
	keyfile: string,
	// server name indication or "disable"
	server_name_indication: string
} & Omit<ConnectionOptionsInternal, 'protocol'>;

/** Type for connection options */
export type ConnectionOptions = ({ protocol: 'amqp:' } & Omit<ConnectionOptionsInternal, 'protocol'>) | ({ protocol: 'amqps:' } & ConnectionOptionsAMQPS);

/**
 * Connection options defaults: common part
 */
const ConnectionOptionsDefaultCommon: Omit<ConnectionOptionsInternal, 'protocol'> = {
	host: '127.0.0.1',
	port: AMQPort,
	username: 'guest',
	password: 'guest',
	vhost: '/',
	auth_mechanism: ['AMQPLAIN', 'PLAIN'],
	channel_max: 0,
	frame_max: 0,
	heartbeat: 0,
	connection_timeout: 60000,
	locale: 'en_US'
};

/**
 * Connection options defaults for AMQP protocol
 */
const ClientOptionsDefaultAMQP: ConnectionOptions = {
	protocol: 'amqp:',
	...ConnectionOptionsDefaultCommon,
	port: AMQPort
};

/**
 * Connection options defaults for AMQPS protocol
 */
const ClientOptionsDefaultAMQPS: ConnectionOptions = {
	protocol: 'amqps:',
	...ConnectionOptionsDefaultCommon,
	port: 5671,
	verify: 'verify_none',
	cacertfile: "",
	certfile: "",
	keyfile: "",
	server_name_indication: 'disable'
};

/**
 * Get socket for AMQP
 * @param this
 * @returns
 */
function getSocketAMQP(this: Client) {
	let called = false;
	return new Promise<Socket>((resolve, reject)=>{
		const socket = new Socket();
		socket.once('error', error=>{
			if (called) return;
			called = true;
			reject(error);
		});

		socket.connect(this.options.port, this.options.host, ()=>{
			if (called) return;
			called = true;
			socket.emit('error', new Error('fake'));
			resolve(socket);
		});
	});
}

/**
 * Get socket for AMQPS
 * @param this
 * @returns
 */
function getSocketAMQPS(this: Client) {
	let called = false;
	let tls_options: TLSConnectionOptions = {} as any;
	const options = this.options as ConnectionOptionsAMQPS;
	if (options.verify === 'verify_peer') {
		tls_options = {
			...tls_options,
			ca: options.cacertfile,
			cert: options.certfile,
			key: options.keyfile
		};
	}

	if (options.server_name_indication !== 'disable') {
		tls_options.servername = options.server_name_indication;
	}
	return new Promise<Socket>((resolve, reject) => {
		const tcp = new Socket;
		const socket = new TLSSocket(tcp);
		socket.once('error', error => {
			if (called) return;
			called = true;
			reject(error);
		});

		socket.connect({
			host: this.options.host,
			port: this.options.port,
			...tls_options
		}, () => {
			if (called) return;
			called = true;
			socket.emit('error', new Error('fake'));
			resolve(socket);
		});
	});
}

/**
 * Client class
 */
export class Client {
	/** Connection options */
	protected readonly options: ConnectionOptions;
	/** Get Socket */
	protected _get_socket: () => Promise<Socket>;

	/**
	 * Create new client
	 * @param options connection options
	 */
	constructor(options: Partial<ConnectionOptions>) {
		const isAMQP = (options.protocol || 'amqp:') === 'amqp:';
		const def_opts = isAMQP ? ClientOptionsDefaultAMQP : ClientOptionsDefaultAMQPS;
		this.options = Object.freeze(MergeObjects(def_opts, options));
		this._get_socket = (isAMQP ? getSocketAMQP : getSocketAMQPS).bind(this);
	}

	/**
	 * Connect to server
	 * @returns
	 */
	protected async _connect() {
		const socket = await this._get_socket();
		const timeout = this.options.connection_timeout;
		if (timeout) {
			socket.setTimeout(timeout, () => {
				socket.destroy(new Error(`Connection timeout [${timeout}] expired`));
			});
		}

		const connection = new ConnectionInternal(socket, this.options, "0.9.1");

		try {
			await connection.open();
		} catch (e) {
			if (!connection.destroyed) {
				connection.destroy(e);
			}
			throw e;
		}

		return connection;
	}

	protected get _get_connection(){
		return async ()=>{
			return this._connect();
		};
	}

	queue(name?: string){
		return new Queue(this._get_connection, name);
	}

	exchange(name: string){
		return new Exchange(this._get_connection, name);
	}

	async publish_writable(highWaterMark = 1){
		const connection = await this._get_connection();
		return new PublishStream(connection, { highWaterMark });
	}

	async create_publisher(highWaterMark = 1){
		const readable = new ReadableAsync<PublishMessage>({highWaterMark, objectMode: true});
		const writable = await this.publish_writable(highWaterMark);
		let closed = false;
		let error: Error | undefined | null = null;
		let current_promise: ({
			resolve: (value: any)=>void,
			reject: (error: Error)=>void
		}) | undefined;

		pipeline(readable, writable, (_error)=>{
			closed = true;
			if (current_promise){
				current_promise.reject(_error || new Error(`Unexpected close`));
			}

			error = _error;
		});

		return {
			get closed(){ return closed; },

			get error(){ return error; },

			async publish(message: Omit<PublishMessage, "callback">){
				if (this.error){
					throw new Error(`Publiser already closed on error ${error?.message}`);
				}

				if (this.closed){
					throw new Error(`Publiser closed`);
				}

				const _message = message as PublishMessage;
				const p = new Promise<any>((resolve, reject) => {
					current_promise = {resolve, reject};
					_message.callback = ((_error?: Error | null, result?: any) => {
						if (_error){
							error = error || _error;
							reject(_error);
						}
						else resolve(result);
						current_promise = undefined;
					});
				});
				await readable.pushAsync(_message);
				await p;
			},

			async close(){
				if (this.closed) return;
				return new Promise<void>((resolve)=>{
					writable.once('finish', ()=>{
						resolve();
					});
					readable.push(null);
				});
			}
		};
	}

	async consumer_transform(options: Partial<ConsumerOptions>){
		const connection = await this._get_connection();
		const channel = await connection.channel_open(ChannelConsume);
		return channel.subscribe(options);
	}
}
