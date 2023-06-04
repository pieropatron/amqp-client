import { Connection, ChannelChildAbstract, GetConnection } from './channel';
import { HardError } from './errors';
import { METHODS, API, EXCHANGE_BIND, EXCHANGE_UNBIND, QUEUE_DECLARE, QUEUE_DECLARE_OK, QUEUE_BIND, QUEUE_UNBIND, QUEUE_PURGE_OK, QUEUE_DELETE_OK } from 'proto/api';
import { MergeObjects } from './utils';

export class CommandChannel extends ChannelChildAbstract {
	handle_body(): void {
		this.destroy(new HardError(METHODS.basic_properties, 'not_allowed', 'Can not handle content for command channel'));
	}

	handle_header(): void {
		this.destroy(new HardError(METHODS.basic_properties, 'not_allowed', 'Can not handle content for command channel'));
	}
}

class CommandBase {
	protected _get_connection: GetConnection;
	constructor(get_connection: GetConnection){
		Object.defineProperty(this, "_get_connection", { value: get_connection });
	}

	protected async execute<T>(command: (connection: Connection, channel: CommandChannel)=>Promise<T>){
		const connection = await this._get_connection();
		const channel = await connection.channel_open(CommandChannel);
		const result = await command(connection, channel);
		await channel.close();
		await connection.close();
		return result;
	}
}

/**
 * Queue/Exchange storage types according to specifications
 */
type QueueExchangeStorageTypes = "durable" | "temporary" | "auto-deleted";

const DefaultExhangeQueueDeclareOptions = {
	storage_type: 'durable' as QueueExchangeStorageTypes
};

/**
 * Known exchange types
 */
type ExchangeTypes = "direct" | "fanout" | "topic" | "headers";

/**
 * Exchange declare options.
 *
 * no-wait not used, as unsafe.
 */
export type ExchangeDeclareOptions = {
	/**
	 * Type of exchange. Default is "direct"
	 *
	 * From specs:
	 * The direct exchange type works as follows:
	 * 1. A message queue binds to the exchange using a routing key, K.
	 * 2. A publisher sends the exchange a message with the routing key R.
	 * 3. The message is passed to the message queue if K = R.
	 *
	 * The fanout exchange type works as follows:
	 * 1. A message queue binds to the exchange with no arguments.
	 * 2. A publisher sends the exchange a message.
	 * 3. The message is passed to the message queue unconditionally.
	 *
	 * The topic exchange type works as follows:
	 * 1. A message queue binds to the exchange using a routing pattern, P.
	 * 2. A publisher sends the exchange a message with the routing key R.
	 * 3. The message is passed to the message queue if R matches P.
	 *
	 * The headers exchange type works as follows:
	 * 1. A message queue is bound to the exchange with a table of arguments containing the headers to be
	 * matched for that binding and optionally the values they should hold. The routing key is not used.
	 * 2. A publisher sends a message to the exchange where the 'headers' property contains a table of
	 * names and values.
	 * 3. The message is passed to the queue if the headers property matches the arguments with which the
	 * queue was bound.
	 */
	type: ExchangeTypes,
	/**
	 * Exchange storage type. Default is "durable"
	 *
	 * From specs:
	 *
	 * 1. Durable exchanges last until they are deleted.
	 * 2. Temporary exchanges last until the server shuts-down. Note: Temporary exchanges not deleted, but purge after server restart.
	 * 3. Auto-deleted exchanges last until they are no longer used.
	 */
	storage_type: QueueExchangeStorageTypes,
	/**
	 * Is exchange internal. Default is false
	 *
	 * If set, the exchange may not be used directly by publishers,
	 * but only when bound to other exchanges. Internal exchanges
	 * are used to construct wiring that is not visible to
	 * applications.
	 */
	internal: boolean,
	/**
	 * Alternate Exchange ("AE") is a feature that let clients handle messages that an exchange was unable to route.
	 *
	 * Optional
	 */
	alternate_exchange?: string
}

const DefaultExchangeDeclareOptions: ExchangeDeclareOptions = {
	...DefaultExhangeQueueDeclareOptions,
	type: 'direct',
	internal: false
};

const QueueExchangeStorageTypeToArgs = (options: { storage_type: QueueExchangeStorageTypes }) => {
	const storage_type = options.storage_type;
	const args = { durable: false, auto_delete: false };
	if (storage_type === 'auto-deleted') {
		args.auto_delete = true;
	} else if (storage_type === 'durable') {
		args.durable = true;
	} else if (storage_type !== 'temporary') {
		throw new Error(`Unknown storage_type = [${storage_type}]`);
	}
	return args;
};

export class Exchange extends CommandBase {
	private readonly _name: string;
	constructor(get_connection: GetConnection, name: string){
		super(get_connection);
		if (!name){
			throw new Error(`Exchange name required`);
		}
		this._name = name;
	}

	get name(){ return this._name; }

	async declare(options: Partial<ExchangeDeclareOptions>, custom?: any){
		custom = custom || {};
		const _options = MergeObjects(DefaultExchangeDeclareOptions, options);
		const {auto_delete, durable} = QueueExchangeStorageTypeToArgs(_options);

		if (_options.alternate_exchange !== undefined) {
			custom["alternate-exchange"] = _options.alternate_exchange;
		}

		return this.execute<void>(async (connection, channel)=>{
			await channel.call_api([METHODS.exchange_declare_ok], async ()=>{
				return API.exchange_declare(connection.socket, channel.channel, {
					exchange: this._name,
					no_wait: false,
					auto_delete,
					durable,
					internal: _options.internal,
					passive: false,
					type: _options.type,
					arguments: custom
				});
			});
		});
	}

	/**
	 * Check if exchange exists
	 */
	async exists() {
		return new Promise<boolean>(resolve=>{
			this.execute<void>(async (connection, channel) => {
				await channel.call_api([METHODS.exchange_declare_ok], async () => {
					return API.exchange_declare(connection.socket, channel.channel, {
						exchange: this._name,
						no_wait: false,
						auto_delete: false,
						durable: false,
						internal: false,
						passive: true,
						type: DefaultExchangeDeclareOptions.type,
						arguments: {}
					});
				});
			}).then(()=>resolve(true), ()=>resolve(false));
		});
	}

	/**
	 * Delete exchange
	 */
	async delete() {
		const exist = await this.exists();
		if (!exist) {
			return false;
		}

		await this.execute<void>(async (connection, channel) => {
			await channel.call_api([METHODS.exchange_delete_ok], async () => {
				return API.exchange_delete(connection.socket, channel.channel, {
					exchange: this._name,
					no_wait: false,
					if_unused: true
				});
			});
		});
		return true;
	}

	protected async check_bind_unbind(options: Pick<EXCHANGE_BIND, 'destination' | 'routing_key'>){
		if (!(await this.exists())) {
			return false;
		}

		if (options.destination){
			const destination = new Exchange(this._get_connection, options.destination);
			if (!(await destination.exists())) {
				return false;
			}
		}
		return true;
	}

	async bind(options: Pick<EXCHANGE_BIND, 'destination' | 'routing_key'>, custom?: any){
		if (!(await this.check_bind_unbind(options))){
			return false;
		}

		await this.execute<void>(async (connection, channel) => {
			await channel.call_api([METHODS.exchange_bind_ok], async () => {
				return API.exchange_bind(connection.socket, channel.channel, {
					...options,
					no_wait: false,
					source: this._name,
					arguments: custom || {}
				});
			});
		});
		return true;
	}

	async unbind(options: Pick<EXCHANGE_UNBIND, 'destination' | 'routing_key'>, custom?: any){
		if (!(await this.check_bind_unbind(options))) {
			return false;
		}

		await this.execute<void>(async (connection, channel) => {
			await channel.call_api([METHODS.exchange_unbind_ok], async () => {
				return API.exchange_unbind(connection.socket, channel.channel, {
					...options,
					no_wait: false,
					source: this._name,
					arguments: custom || {}
				});
			});
		});
		return true;
	}
}


/**
 * Queue declare options.
 *
 * no-wait not used, as unsafe.
 */
type QueueDeclareOptionsInternal = {
	/**
	 * Queue storage type. Default is "durable"
	 *
	 * From specs:
	 *
	 * 1. Durable queue last until they are deleted.
	 * 2. Temporary queue last until the server shuts-down. Note: Temporary queue not deleted, but purge after server restart.
	 * 3. Auto-deleted queue last until they are no longer used.
	 */
	storage_type: QueueExchangeStorageTypes,
	/**
	 * Private (exclusive) queues may only be accessed by the current connection,
	 * and are deleted when that connection closes.
	 *
	 * Passive declaration of private queue by other connections are not allowed.
	 */
	private: boolean
}

type QueueDeclareArgumentsAll = {
	/**
	 * Exchange for republish "dead-lettered" messages (DLX).
	 *
	 * Corresponded key of queue argument: "x-dead-letter-exchange".
	 */
	dead_letter_exchange: string,
	/**
	 * Specify a routing key to be used when dead-lettering messages.
	 * If this is not set, the message's own routing keys will be used.
	 *
	 * Corresponded key of queue argument: "x-dead-letter-routing-key".
	 */
	dead_letter_routing_key: string,
	/**
	 * Quorum queue: dead-letter strategy.
	 * Please, visit https://www.rabbitmq.com/quorum-queues.html for details.
	 *
	 * Default: at-most-once
	 *
	 * Corresponded key of queue argument: "x-dead-letter-strategy".
	 */
	dead_letter_strategy: "at-most-once" | "at-least-once",
	/**
	 * Quorum queue: limit of unsuccessful delivery attempts.
	 * Please, visit https://www.rabbitmq.com/quorum-queues.html for details.
	 *
	 * Corresponded key of queue argument: "x-delivery-limit".
	 */
	delivery_limit: number,
	/**
	 * Time (in milliseconds) before queue will automatically deleted.
	 *
	 * Corresponded key of queue argument: "x-expires".
	 */
	expires: number,
	/**
	 * Stream queue: limit of nodes for initial stream cluster.
	 * Please, visit https://www.rabbitmq.com/streams.htm  for details.
	 *
	 * Corresponded key of queue argument: "x-initial-cluster-size".
	 */
	initial_cluster_size: number,
	/**
	 * Stream queue: maximum age of the stream.
	 * Please, visit https://www.rabbitmq.com/streams.htm  for details.
	 *
	 * According to specs:
	 * Valid units: Y, M, D, h, m, s
	 * @example "7D"
	 *
	 * Corresponded key of queue argument: "x-max-age".
	 */
	max_age: string,
	/**
	 * Quorum queue: Max size (in bytes) of ready messages in memory.
	 * NB: Size here refers to body size only, excluding message properties and any overheads.
	 * Please, visit https://www.rabbitmq.com/quorum-queues.html for details.
	 *
	 * Corresponded key of queue argument: "x-max-in-memory-bytes".
	 */
	max_in_memory_bytes: number,
	/**
	 * Quorum queue: Max length (amount) of ready messages in memory.
	 * Please, visit https://www.rabbitmq.com/quorum-queues.html for details.
	 *
	 * Corresponded key of queue argument: "x-max-in-memory-length".
	 */
	max_in_memory_length: number,
	/**
	 * Max length (amount) of messages in queue.
	 * Please, visit https://www.rabbitmq.com/maxlength.html for details.
	 *
	 * Corresponded key of queue argument: "x-max-length".
	 */
	max_length: number,
	/**
	 * Max size (in bytes) of messages in queue.
	 * NB: Size here refers to body size only, excluding message properties and any overheads.
	 * Please, visit https://www.rabbitmq.com/maxlength.html for details.
	 *
	 * Corresponded key of queue argument: "x-max-length-bytes".
	 */
	max_length_bytes: number,
	/**
	 * Max supported priority of queue.
	 * Value range 1-255.
	 * Please, visit https://www.rabbitmq.com/priority.html for details.
	 *
	 * Corresponded key of queue argument: "x-max-priority".
	 */
	max_priority: number,
	/**
	 * Time (in milliseconds) to live for queue before it will deleted.
	 * Please, visit https://www.rabbitmq.com/ttl.html for details.
	 *
	 * Corresponded key of queue argument: "x-message-ttl".
	 */
	message_ttl: number,
	/**
	 * Default Max Queue Length Limit Behaviour.
	 * Default value: "drop-head".
	 * Please, visit https://www.rabbitmq.com/maxlength.html for details.
	 *
	 * Corresponded key of queue argument: "x-overflow"
	 */
	overflow: "drop-head" | "reject-publish" | "reject-publish-dlx",
	/**
	 * Quorum/Stream queue: Rule for set initial leader for created queue.
	 * Default value: "client-local".
	 * Please, visit https://www.rabbitmq.com/quorum-queues.html or https://www.rabbitmq.com/streams.html for details.

	 * Corresponded key of queue argument: "x-queue-leader-locator"
	 */
	queue_leader_locator: "client-local" | "balanced",
	/**
	 * Classic queue: Rule for set master for created queue.
	 * NB: deprecated, will be removed in future version of RabbitMQ. Please, use quorum/stream queues logic instead.
	 * Please, visit https://www.rabbitmq.com/ha.html for details.
	 *
	 * Corresponded key of queue argument: "x-queue-master-locator"
	 */
	queue_master_locator: string,
	/**
	 * Classic queue: Allows to set "lazy" mode for queue.
	 * Default value: "default".
	 * NB: deprecated, will be removed in future version of RabbitMQ. Please, use quorum/stream queues logic instead.
	 * Please, visit https://www.rabbitmq.com/lazy-queues.html for details.
	 *
	 * Corresponded key of queue argument: "x-queue-mode"
	 */
	queue_mode: "default" | "lazy",
	/**
	 * Type of the queue.
	 * Default is default for vhost.
	 *
	 * Corresponded key of queue argument: "x-queue-type".
	 */
	queue_type: "classic" | "quorum" | "stream",
	/**
	 * Classic queue: Version of Queue.
	 * Default is value of setting classic_queue.default_version in rabbitmq.conf (on server).
	 * Please, visit https://www.rabbitmq.com/persistence-conf.html for details.
	 *
	 * Corresponded key of queue argument: "x-queue-version"
	 */
	queue_version: 1 | 2,
	/**
	 * Quorum queue: default quorum queue size.
	 * Please, visit https://www.rabbitmq.com/quorum-queues.html for details.
	 *
	 * Corresponded key of queue argument: "x-quorum-initial-group-size"
	 */
	quorum_initial_group_size: string,
	/**
	 * Sets queue to single consumer mode.
	 * From specs:
	 * Single active consumer allows to have only one consumer at a time consuming from a queue and
	 * to fail over to another registered consumer in case the active one is cancelled or dies.
	 * Consuming with only one consumer is useful when messages must be consumed and
	 * processed in the same order they arrive in the queue.
	 * Please, visit https://www.rabbitmq.com/consumers.html#single-active-consumer for details.
	 *
	 * Corresponded key of queue argument: "x-single-active-consumer"
	 */
	single_active_consumer: string,
	/**
	 * Stream queue: controls size of fixed size segments files on disk.
	 * Default value: 500000000 bytes.
	 * Please, visit https://www.rabbitmq.com/streams.html for details.
	 *
	 * Corresponded key of queue argument: "x-stream-max-segment-size-bytes"
	 */
	stream_max_segment_size_bytes: string
}

type QueueDeclareArgumentsClassic = Partial<Pick<
	QueueDeclareArgumentsAll,
	"dead_letter_exchange" | "dead_letter_routing_key" | "expires" | "max_length" | "max_length_bytes" |
	"max_priority" | "message_ttl" | "overflow" | "queue_master_locator" | "queue_mode" |
	"queue_version" | "single_active_consumer"
>>;

type QueueDeclareArgumentsQuorum = Partial<Pick<
	QueueDeclareArgumentsAll,
	"dead_letter_exchange" | "dead_letter_routing_key" | "dead_letter_strategy" | "delivery_limit" | "expires" |
	"max_in_memory_bytes" | "max_in_memory_length" | "max_length" | "max_length_bytes" | "message_ttl" | "overflow" |
	"queue_leader_locator" | "quorum_initial_group_size" | "single_active_consumer"
>>;

type QueueDeclareArgumentsStream = Partial<Pick<
	QueueDeclareArgumentsAll,
	"initial_cluster_size" | "max_age" | "max_length_bytes" | "queue_leader_locator" |
	"stream_max_segment_size_bytes"
>>;

export type QueueDeclareOptions = QueueDeclareOptionsInternal & (
	({ queue_type: "classic" } & QueueDeclareArgumentsClassic) |
	({ queue_type: "quorum" } & QueueDeclareArgumentsQuorum) |
	({ queue_type: "stream" } & QueueDeclareArgumentsStream)
);

const DefaultQueueDeclareOptions: QueueDeclareOptions = {
	...DefaultExhangeQueueDeclareOptions,
	queue_type: 'classic',
	private: false
};

export class Queue extends CommandBase {
	private readonly _name: string;
	constructor(get_connection: GetConnection, name?: string){
		super(get_connection);
		this._name = name || "";
	}

	get name(){ return this._name; }

	protected async _declare(args: QUEUE_DECLARE){
		return this.execute(async (connection, channel) => {
			const response = await channel.call_api([METHODS.queue_declare_ok], async () => {
				await API.queue_declare(connection.socket, channel.channel, args);
			});
			if (!response || response.method_id !== METHODS.queue_declare_ok){
				throw new HardError(METHODS.queue_declare, 'command_invalid', `Invalid response`, response);
			}
			return response.args as QUEUE_DECLARE_OK;
		});
	}

	async declare(options: Partial<QueueDeclareOptions>, custom?: any){
		custom = custom || {};
		const _options = MergeObjects(DefaultQueueDeclareOptions, options);
		const { auto_delete, durable } = QueueExchangeStorageTypeToArgs(_options as any);

		for (const key in options) {
			if (key !== 'storage_type' && key !== 'private' && !(key in custom)) {
				custom[`x-${key.replace("_", "-")}`] = options[key];
			}
		}

		return this._declare({
			auto_delete,
			durable,
			exclusive: !!options.private,
			no_wait: false,
			passive: false,
			queue: this._name,
			arguments: custom
		});
	}

	async exists(){
		try {
			await this._declare({
				auto_delete: false,
				durable: false,
				exclusive: false,
				no_wait: false,
				passive: true,
				queue: this._name,
				arguments: {}
			});
			return true;
		} catch (e){
			return false;
		}
	}

	async stat(){
		return this._declare({
			auto_delete: false,
			durable: false,
			exclusive: false,
			no_wait: false,
			passive: true,
			queue: this._name,
			arguments: {}
		});
	}

	protected async check_bind_unbind(options: Pick<QUEUE_BIND, 'exchange' | 'routing_key'>) {
		if (!(await this.exists())) {
			return false;
		}

		if (options.exchange) {
			const exchange = new Exchange(this._get_connection, options.exchange);
			if (!(await exchange.exists())) {
				return false;
			}
		}
		return true;
	}

	async bind(options: Pick<QUEUE_BIND, 'exchange' | 'routing_key'>, custom?: any) {
		if (!(await this.check_bind_unbind(options))) {
			return false;
		}

		await this.execute<void>(async (connection, channel) => {
			await channel.call_api([METHODS.queue_bind_ok], async () => {
				return API.queue_bind(connection.socket, channel.channel, {
					...options,
					no_wait: false,
					queue: this._name || "",
					arguments: custom || {}
				});
			});
		});
		return true;
	}

	async unbind(options: Pick<QUEUE_UNBIND, 'exchange' | 'routing_key'>, custom?: any) {
		if (!(await this.check_bind_unbind(options))) {
			return false;
		}

		await this.execute<void>(async (connection, channel) => {
			await channel.call_api([METHODS.queue_unbind_ok], async () => {
				return API.queue_unbind(connection.socket, channel.channel, {
					...options,
					queue: this._name || "",
					arguments: custom || {}
				});
			});
		});
		return true;
	}

	async purge() {
		return this.execute<QUEUE_PURGE_OK>(async (connection, channel) => {
			const response = await channel.call_api([METHODS.queue_purge_ok], async () => {
				return API.queue_purge(connection.socket, channel.channel, {
					no_wait: false,
					queue: this._name
				});
			});
			if (!response || response.method_id !== METHODS.queue_purge_ok) {
				throw new HardError(METHODS.queue_declare, 'command_invalid', `Invalid response`, response);
			}
			return response.args as QUEUE_PURGE_OK;
		});
	}

	async delete() {
		return this.execute<QUEUE_DELETE_OK>(async (connection, channel) => {
			const response = await channel.call_api([METHODS.queue_delete_ok], async () => {
				return API.queue_delete(connection.socket, channel.channel, {
					if_empty: true,
					if_unused: true,
					no_wait: false,
					queue: this._name
				});
			});

			if (!response || response.method_id !== METHODS.queue_delete_ok) {
				throw new HardError(METHODS.queue_declare, 'command_invalid', `Invalid response`, response);
			}

			return response.args as QUEUE_DELETE_OK;
		});
	}
}
