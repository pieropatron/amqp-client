import { pipeline } from 'stream';
import { ReadableAsync, TransformAsync, TransformAsyncOptions } from '@pieropatron/stream-async';
import { ChannelChildAbstract, Connection } from './channel';
import { BASIC_DELIVER, BASIC_PROPERTIES, METHODS, API, BASIC_CANCEL, BASIC_CONSUME_OK } from '../proto/api';
import { HardError, SoftError } from './errors';

type ConsumeChunkBody = {
	body: Buffer
};

type ConsumeChunkHeader = {
	properties: BASIC_PROPERTIES,
	body_size: number
};

type ConsumeChunkDeliver = {
	deliver: BASIC_DELIVER
};

type ConsumeChunk = ({type: "body"} & ConsumeChunkBody) |
	({ type: "header" } & ConsumeChunkHeader) |
	({ type: "deliver" } & ConsumeChunkDeliver)
	;

export type ConsumerOptions = {
	/** Queue for consume */
	queue: string,
	/**
	 * Prefetch count of messages
 	*/
	prefetch_count: number,
	/**
	 * Do not receive messages from same connection
	 */
	no_local: boolean,
	/**
	 * Identifier for the consumer.
	 *
	 * Two clients can use the same consumer tags.
	 *
	 * In case of empty value, server will generate a unique tag.
	 */
	consumer_tag: string,
	/**
	 * In case of set, only this consumer can access the queue.
	 */
	exclusive: boolean,
	/**
	 * Priority of consumer. Can be positive or negative.
	 *
	 * Set "x-priority" argument value.
	 */
	priority: number,
	/**
	 * @deprecated Classic queue: Cancel consume on failed over of mirrored queue.
	 */
	cancel_on_ha_failover: boolean,
	/**
	 * Stream queue: start offset for read. Possible values:
	 * 1. "first" - start from the first available message in the log
	 * 2. "last" - this starts reading from the last written "chunk" of messages.
	 * 3. "next" - same as not specifying any offset
	 * 4. [num_offset] - a numerical value specifying an exact offset to attach to the log at.
	 * 5. [Date] - a timestamp value specifying the point in time to attach to the log at.
	 * 6. [interval_string] - interval-formatted (7D, etc) string value, specifying the time interval relative to current time to attach the log at.
	 *
	 * Please, visit https://www.rabbitmq.com/streams.html#consuming for details.
	 */
	stream_offset: string,
	custom: Record<string, any>
};

export class ChannelConsume extends ChannelChildAbstract {
	private _input: ReadableAsync<ConsumeChunk>;
	private _consumer_tag: string;
	private _cancelled = false;

	constructor(connection: Connection, channel: number){
		super(connection, channel);

		this.handlers
			.set(METHODS.basic_deliver, async (args: BASIC_DELIVER)=>{
				if (this._consumer_tag && (args.consumer_tag !== this._consumer_tag)){
					return this.destroy(new SoftError(METHODS.basic_deliver, 'no_consumers', `Invalid consumer tag`, args));
				}
				if (this._input.destroyed) return;
				this._input.push({ type: 'deliver', deliver: args });
			})
			.set(METHODS.basic_cancel, async (args: BASIC_CANCEL)=>{
				if (this._cancelled){
					return;
				}

				await API.basic_cancel_ok(this.socket, channel, {
					consumer_tag: args.consumer_tag
				});

				this.destroy(new HardError(METHODS.basic_cancel, 'connection_forced', `Consumer cancelled`, args));
			})
			;

		this._input = new ReadableAsync<ConsumeChunk>({highWaterMark: 1, objectMode: true});
	}

	get frame_max() {
		return this.connection.options.frame_max;
	}

	handle_body(body: Buffer): void {
		process.nextTick(() => {
			if (this._input.destroyed) return;
			this._input.push({type: 'body', body});
		});
	}

	handle_header(body_size: bigint, properties: BASIC_PROPERTIES): void {
		process.nextTick(() => {
			if (this._input.destroyed) return;
			this._input.push({ type: 'header', properties, body_size: Number(body_size) });
		});
	}

	destroy(error?: Error | null | undefined): void {
		if (!this._input.destroyed && !this._cancelled){
			this._input.push(null);
		}
		this._cancelled = true;
		super.destroy(error);
		this.destroyed = true;
	}

	async subscribe(opts: Partial<ConsumerOptions>){
		const prefetch_count = opts.prefetch_count || 1;

		await this.call_api([METHODS.basic_qos_ok], async ()=>{
			return API.basic_qos(this.socket, this.channel, {
				global: true,
				prefetch_count,
				prefetch_size: 0
			});
		});

		const transform = new ConsumeStream(this, {highWaterMark: prefetch_count});
		pipeline(this._input, transform, (error?: Error | null)=>{
			if (this.destroyed) {
				return;
			}
			this.connection.destroy(error);
		});

		const custom = opts.custom || {};
		if ("priority" in opts) {
			custom['x-priority'] = opts.priority;
		}
		if ("cancel_on_ha_failover" in opts) {
			custom['x-cancel-on-ha-failover'] = opts.cancel_on_ha_failover;
		}
		if ("stream_offset" in opts) {
			custom['x-stream-offset'] = opts.stream_offset;
		}

		const response = await this.call_api([METHODS.basic_consume_ok], async () => {
			await API.basic_consume(this.socket, this.channel, {
				arguments: custom,
				queue: opts.queue || "",
				no_wait: false,
				no_local: !!opts.no_local,
				consumer_tag: opts.consumer_tag || "",
				exclusive: !!opts.exclusive,
				no_ack: false
			});
		});

		if (!response || (response.method_id !== METHODS.basic_consume_ok)){
			throw new SoftError(METHODS.basic_consume, "not_found", `Unexpected response`, response);
		}

		const args: BASIC_CONSUME_OK = response.args;
		this._consumer_tag = args.consumer_tag;

		return transform;
	}

	unsubscribe(){
		if (this._cancelled) return;
		this._cancelled = true;
		this._input.push(null);
	}
}

class ConsumerBodyReadable extends ReadableAsync<Buffer> {
	async toBuffer() {
		const results: Buffer[] = [];
		for await (const data of this) {
			results.push(data);
		}
		return Buffer.concat(results);
	}
}

export type ConsumeMessage = {
	properties?: BASIC_PROPERTIES,
	body?: ConsumerBodyReadable,
	body_size?: number,
	ack: ()=>Promise<void>,
	nack: (requeue: boolean)=>Promise<void>
} & BASIC_DELIVER;

export class ConsumeStream extends TransformAsync<ConsumeChunk, ConsumeMessage> {
	private _channel: ChannelConsume;
	private _current?: ConsumeMessage;
	private _wait_size = 0;

	constructor(channel: ChannelConsume, opts: TransformAsyncOptions<ConsumeChunk, ConsumeMessage>){
		opts.objectMode = true;
		super(opts);
		this._channel = channel;
	}

	protected async flush_message(needPush: boolean){
		const current = this._current;
		if (current === undefined){
			throw new Error(`Unexprected missed current`);
		}

		if (current.body){
			current.body.push(null);
		}

		if (needPush){
			await this.pushAsync(current);
		}
		delete this._current;
		this._wait_size = 0;
	}

	async _writeAsync(chunk: ConsumeChunk){
		const current = this._current;
		if (chunk.type === 'deliver'){
			if (current !== undefined){
				throw new HardError(METHODS.basic_consume, 'unexpected_frame', 'Unexpected not finished message on deliver');
			}

			const delivery_tag = chunk.deliver.delivery_tag;
			let called = false;
			this._current = {
				...chunk.deliver,
				body_size: 0,
				ack: async ()=>{
					if (called) return;
					called = true;
					await this._channel.call_api([], async ()=>{
						API.basic_ack(this._channel.socket, this._channel.channel, {
							delivery_tag,
							multiple: false
						});
					});
				},
				nack: async (requeue: boolean)=>{
					if (called) return;
					called = true;
					await this._channel.call_api([], async () => {
						API.basic_nack(this._channel.socket, this._channel.channel, {
							delivery_tag,
							multiple: false,
							requeue
						});
					});
				}
			};
		} else if (chunk.type === 'header'){
			if ((current === undefined) || current.properties) {
				throw new HardError(METHODS.basic_consume, 'unexpected_frame', 'Unexpected header');
			}

			current.properties = chunk.properties || {};
			if (chunk.body_size){
				current.body_size = chunk.body_size;
				current.body = new ConsumerBodyReadable({
					highWaterMark: this._channel.frame_max,
					objectMode: false,
					read() {}
				});
				this._wait_size = chunk.body_size;
				await this.pushAsync(current);
			} else {
				return this.flush_message(true);
			}
		} else if (chunk.type === 'body'){
			if ((current === undefined) || !current.properties) {
				throw new HardError(METHODS.basic_consume, 'unexpected_frame', 'Unexpected body');
			}

			const body = chunk.body;
			if (!body.length) {
				return;
			}

			const wait_size = (this._wait_size - body.length);
			if (wait_size < 0){
				throw new HardError(METHODS.basic_consume, 'unexpected_frame', 'Body size exceeded');
			}

			if (current.body){
				current.body.push(body);
			} else {
				throw new HardError(METHODS.basic_consume, 'unexpected_frame', 'Body size exceeded');
			}

			if (wait_size === 0){
				return this.flush_message(false);
			}

			this._wait_size = wait_size;
		} else {
			throw new HardError(METHODS.basic_consume, 'unexpected_frame', `Unknown content chunk.type ${(chunk as any).type}`);
		}
	}

	unsubscribe(){
		return this._channel.unsubscribe();
	}
}
