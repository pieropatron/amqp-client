import { Socket } from "net";
import { BufferReader, BufferWriter, ASSERTS, ENCODING, writeSocket, writeVoid, EMPTY_FRAME_SIZE } from './codec';
import { FRAME_CONST } from './constant';

export type CONNECTION_START = {
	/**
	 * @doc
	 * The major version number can take any value from 0 to 99 as defined in the
	 * AMQP specification.
	 * @label
	 * protocol major version
	 */
	version_major: number,
	/**
	 * @doc
	 * The minor version number can take any value from 0 to 99 as defined in the
	 * AMQP specification.
	 * @label
	 * protocol minor version
	 */
	version_minor: number,
	/**
	 * @label
	 * server properties
	 * @rule
	 * + @name required-fields
	 * + @doc
	 * + The properties SHOULD contain at least these fields: "host", specifying the
	 * + server host name or address, "product", giving the name of the server product,
	 * + "version", giving the name of the server version, "platform", giving the name
	 * + of the operating system, "copyright", if appropriate, and "information", giving
	 * + other general information.
	 * + @scenario
	 * + Client connects to server and inspects the server properties. It checks for
	 * + the presence of the required fields.
	 */
	server_properties: object,
	/**
	 * @doc
	 * A list of the security mechanisms that the server supports, delimited by spaces.
	 * @label
	 * available security mechanisms
	 */
	mechanisms: string,
	/**
	 * @doc
	 * A list of the message locales that the server supports, delimited by spaces. The
	 * locale defines the language in which the server will send reply texts.
	 * @label
	 * available message locales
	 * @rule
	 * + @name required-support
	 * + @doc
	 * + The server MUST support at least the en_US locale.
	 * + @scenario
	 * + Client connects to server and inspects the locales field. It checks for
	 * + the presence of the required locale(s).
	 */
	locales: string
};
export type CONNECTION_START_OK = {
	/**
	 * @label
	 * client properties
	 * @rule
	 * + @name required-fields
	 * + @doc
	 * + The properties SHOULD contain at least these fields: "product", giving the name
	 * + of the client product, "version", giving the name of the client version, "platform",
	 * + giving the name of the operating system, "copyright", if appropriate, and
	 * + "information", giving other general information.
	 */
	client_properties: object,
	/**
	 * @doc
	 * A single security mechanisms selected by the client, which must be one of those
	 * specified by the server.
	 * @label
	 * selected security mechanism
	 * @rule
	 * + @name security
	 * + @doc
	 * + The client SHOULD authenticate using the highest-level security profile it
	 * + can handle from the list provided by the server.
	 * @rule
	 * + @name validity
	 * + @doc
	 * + If the mechanism field does not contain one of the security mechanisms
	 * + proposed by the server in the Start method, the server MUST close the
	 * + connection without sending any further data.
	 * + @scenario
	 * + Client connects to server and sends an invalid security mechanism. The
	 * + server must respond by closing the connection (a socket close, with no
	 * + connection close negotiation).
	 */
	mechanism: string,
	/**
	 * @doc
	 * A block of opaque data passed to the security mechanism. The contents of this
	 * data are defined by the SASL security mechanism.
	 * @label
	 * security response data
	 */
	response: string,
	/**
	 * @doc
	 * A single message locale selected by the client, which must be one of those
	 * specified by the server.
	 * @label
	 * selected message locale
	 */
	locale: string
};
export type CONNECTION_SECURE = {
	/**
	 * @doc
	 * Challenge information, a block of opaque binary data passed to the security
	 * mechanism.
	 * @label
	 * security challenge data
	 */
	challenge: string
};
export type CONNECTION_SECURE_OK = {
	/**
	 * @doc
	 * A block of opaque data passed to the security mechanism. The contents of this
	 * data are defined by the SASL security mechanism.
	 * @label
	 * security response data
	 */
	response: string
};
export type CONNECTION_TUNE = {
	/**
	 * @doc
	 * Specifies highest channel number that the server permits.  Usable channel numbers
	 * are in the range 1..channel-max.  Zero indicates no specified limit.
	 * @label
	 * proposed maximum channels
	 */
	channel_max: number,
	/**
	 * @doc
	 * The largest frame size that the server proposes for the connection, including
	 * frame header and end-byte.  The client can negotiate a lower value. Zero means
	 * that the server does not impose any specific limit but may reject very large
	 * frames if it cannot allocate resources for them.
	 * @label
	 * proposed maximum frame size
	 * @rule
	 * + @name minimum
	 * + @doc
	 * + Until the frame-max has been negotiated, both peers MUST accept frames of up
	 * + to frame-min-size octets large, and the minimum negotiated value for frame-max
	 * + is also frame-min-size.
	 * + @scenario
	 * + Client connects to server and sends a large properties field, creating a frame
	 * + of frame-min-size octets.  The server must accept this frame.
	 */
	frame_max: number,
	/**
	 * @doc
	 * The delay, in seconds, of the connection heartbeat that the server wants.
	 * Zero means the server does not want a heartbeat.
	 * @label
	 * desired heartbeat delay
	 */
	heartbeat: number
};
export type CONNECTION_TUNE_OK = {
	/**
	 * @doc
	 * The maximum total number of channels that the client will use per connection.
	 * @label
	 * negotiated maximum channels
	 * @rule
	 * + @name upper-limit
	 * + @doc
	 * + If the client specifies a channel max that is higher than the value provided
	 * + by the server, the server MUST close the connection without attempting a
	 * + negotiated close.  The server may report the error in some fashion to assist
	 * + implementors.
	 */
	channel_max: number,
	/**
	 * @doc
	 * The largest frame size that the client and server will use for the connection.
	 * Zero means that the client does not impose any specific limit but may reject
	 * very large frames if it cannot allocate resources for them. Note that the
	 * frame-max limit applies principally to content frames, where large contents can
	 * be broken into frames of arbitrary size.
	 * @label
	 * negotiated maximum frame size
	 * @rule
	 * + @name minimum
	 * + @doc
	 * + Until the frame-max has been negotiated, both peers MUST accept frames of up
	 * + to frame-min-size octets large, and the minimum negotiated value for frame-max
	 * + is also frame-min-size.
	 * @rule
	 * + @name upper-limit
	 * + @doc
	 * + If the client specifies a frame max that is higher than the value provided
	 * + by the server, the server MUST close the connection without attempting a
	 * + negotiated close. The server may report the error in some fashion to assist
	 * + implementors.
	 */
	frame_max: number,
	/**
	 * @doc
	 * The delay, in seconds, of the connection heartbeat that the client wants. Zero
	 * means the client does not want a heartbeat.
	 * @label
	 * desired heartbeat delay
	 */
	heartbeat: number
};
export type CONNECTION_OPEN = {
	/**
	 * @doc
	 * The name of the virtual host to work with.
	 * @label
	 * virtual host name
	 * @rule
	 * + @name separation
	 * + @doc
	 * + If the server supports multiple virtual hosts, it MUST enforce a full
	 * + separation of exchanges, queues, and all associated entities per virtual
	 * + host. An application, connected to a specific virtual host, MUST NOT be able
	 * + to access resources of another virtual host.
	 * @rule
	 * + @name security
	 * + @doc
	 * + The server SHOULD verify that the client has permission to access the
	 * + specified virtual host.
	 */
	virtual_host: string
};
export type CONNECTION_CLOSE = {
	reply_code: number,
	reply_text: string,
	/**
	 * @doc
	 * When the close is provoked by a method exception, this is the class of the
	 * method.
	 * @label
	 * failing method class
	 * @doc
	 * When the close is provoked by a method exception, this is the ID of the method.
	 * @label
	 * failing method ID
	 */
	method_id: number
};
export type CONNECTION_BLOCKED = {
	/**
	 * @doc
	 * The reason the connection was blocked.
	 * @label
	 * Block reason
	 */
	reason: string
};
export type CONNECTION_UPDATE_SECRET = {
	/**
	 * @doc
	 * The new secret.
	 * @label
	 * new secret
	 */
	new_secret: string,
	/**
	 * @doc
	 * The reason for the secret update.
	 * @label
	 * reason
	 */
	reason: string
};
export type CHANNEL_FLOW = {
	/**
	 * @doc
	 * If 1, the peer starts sending content frames. If 0, the peer stops sending
	 * content frames.
	 * @label
	 * start/stop content frames
	 */
	active: boolean
};
export type CHANNEL_FLOW_OK = {
	/**
	 * @doc
	 * Confirms the setting of the processed flow method: 1 means the peer will start
	 * sending or continue to send content frames; 0 means it will not.
	 * @label
	 * current flow setting
	 */
	active: boolean
};
export type CHANNEL_CLOSE = {
	reply_code: number,
	reply_text: string,
	/**
	 * @doc
	 * When the close is provoked by a method exception, this is the class of the
	 * method.
	 * @label
	 * failing method class
	 * @doc
	 * When the close is provoked by a method exception, this is the ID of the method.
	 * @label
	 * failing method ID
	 */
	method_id: number
};
export type EXCHANGE_DECLARE = {
	/**
	 * @rule
	 * + @name reserved
	 * + @doc
	 * + Exchange names starting with "amq." are reserved for pre-declared and
	 * + standardised exchanges. The client MAY declare an exchange starting with
	 * + "amq." if the passive option is set, or the exchange already exists.
	 * + @scenario
	 * + The client attempts to declare a non-existing exchange starting with
	 * + "amq." and with the passive option set to zero.
	 * + @on-failure
	 * + access-refused
	 * @rule
	 * + @name syntax
	 * + @doc
	 * + The exchange name consists of a non-empty sequence of these characters:
	 * + letters, digits, hyphen, underscore, period, or colon.
	 * + @scenario
	 * + The client attempts to declare an exchange with an illegal name.
	 * + @on-failure
	 * + precondition-failed
	 */
	exchange: string,
	/**
	 * @doc
	 * Each exchange belongs to one of a set of exchange types implemented by the
	 * server. The exchange types define the functionality of the exchange - i.e. how
	 * messages are routed through it. It is not valid or meaningful to attempt to
	 * change the type of an existing exchange.
	 * @label
	 * exchange type
	 * @rule
	 * + @name typed
	 * + @doc
	 * + Exchanges cannot be redeclared with different types.  The client MUST not
	 * + attempt to redeclare an existing exchange with a different type than used
	 * + in the original Exchange.Declare method.
	 * + @scenario
	 * + TODO.
	 * + @on-failure
	 * + not-allowed
	 * @rule
	 * + @name support
	 * + @doc
	 * + The client MUST NOT attempt to declare an exchange with a type that the
	 * + server does not support.
	 * + @scenario
	 * + TODO.
	 * + @on-failure
	 * + command-invalid
	 */
	type: string,
	/**
	 * @doc
	 * If set, the server will reply with Declare-Ok if the exchange already
	 * exists with the same name, and raise an error if not.  The client can
	 * use this to check whether an exchange exists without modifying the
	 * server state. When set, all other method fields except name and no-wait
	 * are ignored.  A declare with both passive and no-wait has no effect.
	 * Arguments are compared for semantic equivalence.
	 * @label
	 * do not create exchange
	 * @rule
	 * + @name not-found
	 * + @doc
	 * + If set, and the exchange does not already exist, the server MUST
	 * + raise a channel exception with reply code 404 (not found).
	 * + @scenario
	 * + TODO.
	 * @rule
	 * + @name equivalent
	 * + @doc
	 * + If not set and the exchange exists, the server MUST check that the
	 * + existing exchange has the same values for type, durable, and arguments
	 * + fields.  The server MUST respond with Declare-Ok if the requested
	 * + exchange matches these fields, and MUST raise a channel exception if
	 * + not.
	 * + @scenario
	 * + TODO.
	 */
	passive: boolean,
	/**
	 * @doc
	 * If set when creating a new exchange, the exchange will be marked as durable.
	 * Durable exchanges remain active when a server restarts. Non-durable exchanges
	 * (transient exchanges) are purged if/when a server restarts.
	 * @label
	 * request a durable exchange
	 * @rule
	 * + @name support
	 * + @doc
	 * + The server MUST support both durable and transient exchanges.
	 * + @scenario
	 * + TODO.
	 */
	durable: boolean,
	/**
	 * @doc
	 * If set, the exchange is deleted when all queues have
	 * finished using it.
	 * @label
	 * auto-delete when unused
	 * @rule
	 * + @name amq_exchange_02
	 * + @doc
	 * + The server SHOULD allow for a reasonable delay between the
	 * + point when it determines that an exchange is not being
	 * + used (or no longer used), and the point when it deletes
	 * + the exchange.  At the least it must allow a client to
	 * + create an exchange and then bind a queue to it, with a
	 * + small but non-zero delay between these two actions.
	 * @rule
	 * + @name amq_exchange_25
	 * + @doc
	 * + The server MUST ignore the auto-delete field if the
	 * + exchange already exists.
	 */
	auto_delete: boolean,
	/**
	 * @doc
	 * If set, the exchange may not be used directly by publishers,
	 * but only when bound to other exchanges. Internal exchanges
	 * are used to construct wiring that is not visible to
	 * applications.
	 * @label
	 * create internal exchange
	 */
	internal: boolean,
	no_wait: boolean,
	/**
	 * @doc
	 * A set of arguments for the declaration. The syntax and semantics of these
	 * arguments depends on the server implementation.
	 * @label
	 * arguments for declaration
	 */
	arguments: object
};
export type EXCHANGE_DELETE = {
	/**
	 * @rule
	 * + @name exists
	 * + @doc
	 * + The client MUST NOT attempt to delete an exchange that does not exist.
	 * + @on-failure
	 * + not-found
	 */
	exchange: string,
	/**
	 * @doc
	 * If set, the server will only delete the exchange if it has no queue bindings. If
	 * the exchange has queue bindings the server does not delete it but raises a
	 * channel exception instead.
	 * @label
	 * delete only if unused
	 * @rule
	 * + @name in-use
	 * + @doc
	 * + The server MUST NOT delete an exchange that has bindings on it, if the if-unused
	 * + field is true.
	 * + @scenario
	 * + The client declares an exchange, binds a queue to it, then tries to delete it
	 * + setting if-unused to true.
	 * + @on-failure
	 * + precondition-failed
	 */
	if_unused: boolean,
	no_wait: boolean
};
export type EXCHANGE_BIND = {
	/**
	 * @doc
	 * Specifies the name of the destination exchange to bind.
	 * @label
	 * name of the destination exchange to bind to
	 * @rule
	 * + @name exchange-existence
	 * + @doc
	 * + A client MUST NOT be allowed to bind a non-existent
	 * + destination exchange.
	 * + @scenario
	 * + A client attempts to bind an undeclared exchange to an
	 * + exchange.
	 * + @on-failure
	 * + not-found
	 * @rule
	 * + @name default-exchange
	 * + @doc
	 * + The server MUST accept a blank exchange name to mean the
	 * + default exchange.
	 * + @scenario
	 * + The client declares an exchange and binds a blank exchange
	 * + name to it.
	 */
	destination: string,
	/**
	 * @doc
	 * Specifies the name of the source exchange to bind.
	 * @label
	 * name of the source exchange to bind to
	 * @rule
	 * + @name exchange-existence
	 * + @doc
	 * + A client MUST NOT be allowed to bind a non-existent source
	 * + exchange.
	 * + @scenario
	 * + A client attempts to bind an exchange to an undeclared
	 * + exchange.
	 * + @on-failure
	 * + not-found
	 * @rule
	 * + @name default-exchange
	 * + @doc
	 * + The server MUST accept a blank exchange name to mean the
	 * + default exchange.
	 * + @scenario
	 * + The client declares an exchange and binds it to a blank
	 * + exchange name.
	 */
	source: string,
	/**
	 * @doc
	 * Specifies the routing key for the binding. The routing key
	 * is used for routing messages depending on the exchange
	 * configuration. Not all exchanges use a routing key - refer
	 * to the specific exchange documentation.
	 * @label
	 * message routing key
	 */
	routing_key: string,
	no_wait: boolean,
	/**
	 * @doc
	 * A set of arguments for the binding. The syntax and semantics
	 * of these arguments depends on the exchange class.
	 * @label
	 * arguments for binding
	 */
	arguments: object
};
export type EXCHANGE_UNBIND = {
	/**
	 * @doc
	 * Specifies the name of the destination exchange to unbind.
	 * @rule
	 * + @name must-exist
	 * + @doc
	 * + The client MUST NOT attempt to unbind an exchange that
	 * + does not exist from an exchange.
	 * + @scenario
	 * + The client attempts to unbind a non-existent exchange from
	 * + an exchange.
	 * + @on-failure
	 * + not-found
	 * @rule
	 * + @name default-exchange
	 * + @doc
	 * + The server MUST accept a blank exchange name to mean the
	 * + default exchange.
	 * + @scenario
	 * + The client declares an exchange, binds a blank exchange
	 * + name to it, and then unbinds a blank exchange name from
	 * + it.
	 */
	destination: string,
	/**
	 * @doc
	 * Specifies the name of the source exchange to unbind.
	 * @rule
	 * + @name must-exist
	 * + @doc
	 * + The client MUST NOT attempt to unbind an exchange from an
	 * + exchange that does not exist.
	 * + @scenario
	 * + The client attempts to unbind an exchange from a
	 * + non-existent exchange.
	 * + @on-failure
	 * + not-found
	 * @rule
	 * + @name default-exchange
	 * + @doc
	 * + The server MUST accept a blank exchange name to mean the
	 * + default exchange.
	 * + @scenario
	 * + The client declares an exchange, binds an exchange to a
	 * + blank exchange name, and then unbinds an exchange from a
	 * + black exchange name.
	 */
	source: string,
	/**
	 * @doc
	 * Specifies the routing key of the binding to unbind.
	 * @label
	 * routing key of binding
	 */
	routing_key: string,
	no_wait: boolean,
	/**
	 * @doc
	 * Specifies the arguments of the binding to unbind.
	 * @label
	 * arguments of binding
	 */
	arguments: object
};
export type QUEUE_DECLARE = {
	/**
	 * @rule
	 * + @name default-name
	 * + @doc
	 * + The queue name MAY be empty, in which case the server MUST create a new
	 * + queue with a unique generated name and return this to the client in the
	 * + Declare-Ok method.
	 * + @scenario
	 * + Client attempts to declare several queues with an empty name. The client then
	 * + verifies that the server-assigned names are unique and different.
	 * @rule
	 * + @name reserved
	 * + @doc
	 * + Queue names starting with "amq." are reserved for pre-declared and
	 * + standardised queues. The client MAY declare a queue starting with
	 * + "amq." if the passive option is set, or the queue already exists.
	 * + @scenario
	 * + The client attempts to declare a non-existing queue starting with
	 * + "amq." and with the passive option set to zero.
	 * + @on-failure
	 * + access-refused
	 * @rule
	 * + @name syntax
	 * + @doc
	 * + The queue name can be empty, or a sequence of these characters:
	 * + letters, digits, hyphen, underscore, period, or colon.
	 * + @scenario
	 * + The client attempts to declare a queue with an illegal name.
	 * + @on-failure
	 * + precondition-failed
	 */
	queue: string,
	/**
	 * @doc
	 * If set, the server will reply with Declare-Ok if the queue already
	 * exists with the same name, and raise an error if not.  The client can
	 * use this to check whether a queue exists without modifying the
	 * server state.  When set, all other method fields except name and no-wait
	 * are ignored.  A declare with both passive and no-wait has no effect.
	 * Arguments are compared for semantic equivalence.
	 * @label
	 * do not create queue
	 * @rule
	 * + @name passive
	 * + @doc
	 * + The client MAY ask the server to assert that a queue exists without
	 * + creating the queue if not.  If the queue does not exist, the server
	 * + treats this as a failure.
	 * + @scenario
	 * + Client declares an existing queue with the passive option and expects
	 * + the server to respond with a declare-ok. Client then attempts to declare
	 * + a non-existent queue with the passive option, and the server must close
	 * + the channel with the correct reply-code.
	 * + @on-failure
	 * + not-found
	 * @rule
	 * + @name equivalent
	 * + @doc
	 * + If not set and the queue exists, the server MUST check that the
	 * + existing queue has the same values for durable, exclusive, auto-delete,
	 * + and arguments fields.  The server MUST respond with Declare-Ok if the
	 * + requested queue matches these fields, and MUST raise a channel exception
	 * + if not.
	 * + @scenario
	 * + TODO.
	 */
	passive: boolean,
	/**
	 * @doc
	 * If set when creating a new queue, the queue will be marked as durable. Durable
	 * queues remain active when a server restarts. Non-durable queues (transient
	 * queues) are purged if/when a server restarts. Note that durable queues do not
	 * necessarily hold persistent messages, although it does not make sense to send
	 * persistent messages to a transient queue.
	 * @label
	 * request a durable queue
	 * @rule
	 * + @name persistence
	 * + @doc
	 * + The server MUST recreate the durable queue after a restart.
	 * + @scenario
	 * + Client declares a durable queue. The server is then restarted. The client
	 * + then attempts to send a message to the queue. The message should be successfully
	 * + delivered.
	 * @rule
	 * + @name types
	 * + @doc
	 * + The server MUST support both durable and transient queues.
	 * + @scenario
	 * + A client declares two named queues, one durable and one transient.
	 */
	durable: boolean,
	/**
	 * @doc
	 * Exclusive queues may only be accessed by the current connection, and are
	 * deleted when that connection closes.  Passive declaration of an exclusive
	 * queue by other connections are not allowed.
	 * @label
	 * request an exclusive queue
	 * @rule
	 * + @name types
	 * + @doc
	 * + The server MUST support both exclusive (private) and non-exclusive (shared)
	 * + queues.
	 * + @scenario
	 * + A client declares two named queues, one exclusive and one non-exclusive.
	 * @rule
	 * + @name exclusive
	 * + @doc
	 * + The client MAY NOT attempt to use a queue that was declared as exclusive
	 * + by another still-open connection.
	 * + @scenario
	 * + One client declares an exclusive queue. A second client on a different
	 * + connection attempts to declare, bind, consume, purge, delete, or declare
	 * + a queue of the same name.
	 * + @on-failure
	 * + resource-locked
	 */
	exclusive: boolean,
	/**
	 * @doc
	 * If set, the queue is deleted when all consumers have finished using it.  The last
	 * consumer can be cancelled either explicitly or because its channel is closed. If
	 * there was no consumer ever on the queue, it won't be deleted.  Applications can
	 * explicitly delete auto-delete queues using the Delete method as normal.
	 * @label
	 * auto-delete queue when unused
	 * @rule
	 * + @name pre-existence
	 * + @doc
	 * + The server MUST ignore the auto-delete field if the queue already exists.
	 * + @scenario
	 * + Client declares two named queues, one as auto-delete and one explicit-delete.
	 * + Client then attempts to declare the two queues using the same names again,
	 * + but reversing the value of the auto-delete field in each case. Verify that the
	 * + queues still exist with the original auto-delete flag values.
	 */
	auto_delete: boolean,
	no_wait: boolean,
	/**
	 * @doc
	 * A set of arguments for the declaration. The syntax and semantics of these
	 * arguments depends on the server implementation.
	 * @label
	 * arguments for declaration
	 */
	arguments: object
};
export type QUEUE_DECLARE_OK = {
	/**
	 * @doc
	 * Reports the name of the queue. If the server generated a queue name, this field
	 * contains that name.
	 */
	queue: string,
	message_count: number,
	/**
	 * @doc
	 * Reports the number of active consumers for the queue. Note that consumers can
	 * suspend activity (Channel.Flow) in which case they do not appear in this count.
	 * @label
	 * number of consumers
	 */
	consumer_count: number
};
export type QUEUE_BIND = {
	/**
	 * @doc
	 * Specifies the name of the queue to bind.
	 * @rule
	 * + @name queue-known
	 * + @doc
	 * + The client MUST either specify a queue name or have previously declared a
	 * + queue on the same channel
	 * + @scenario
	 * + The client opens a channel and attempts to bind an unnamed queue.
	 * + @on-failure
	 * + not-found
	 * @rule
	 * + @name must-exist
	 * + @doc
	 * + The client MUST NOT attempt to bind a queue that does not exist.
	 * + @scenario
	 * + The client attempts to bind a non-existent queue.
	 * + @on-failure
	 * + not-found
	 */
	queue: string,
	/**
	 * @label
	 * name of the exchange to bind to
	 * @rule
	 * + @name exchange-existence
	 * + @doc
	 * + A client MUST NOT be allowed to bind a queue to a non-existent exchange.
	 * + @scenario
	 * + A client attempts to bind an named queue to a undeclared exchange.
	 * + @on-failure
	 * + not-found
	 * @rule
	 * + @name default-exchange
	 * + @doc
	 * + The server MUST accept a blank exchange name to mean the default exchange.
	 * + @scenario
	 * + The client declares a queue and binds it to a blank exchange name.
	 */
	exchange: string,
	/**
	 * @doc
	 * Specifies the routing key for the binding. The routing key is used for routing
	 * messages depending on the exchange configuration. Not all exchanges use a
	 * routing key - refer to the specific exchange documentation.  If the queue name
	 * is empty, the server uses the last queue declared on the channel.  If the
	 * routing key is also empty, the server uses this queue name for the routing
	 * key as well.  If the queue name is provided but the routing key is empty, the
	 * server does the binding with that empty routing key.  The meaning of empty
	 * routing keys depends on the exchange implementation.
	 * @label
	 * message routing key
	 * @rule
	 * + @name direct-exchange-key-matching
	 * + @doc
	 * + If a message queue binds to a direct exchange using routing key K and a
	 * + publisher sends the exchange a message with routing key R, then the message
	 * + MUST be passed to the message queue if K = R.
	 */
	routing_key: string,
	no_wait: boolean,
	/**
	 * @doc
	 * A set of arguments for the binding. The syntax and semantics of these arguments
	 * depends on the exchange class.
	 * @label
	 * arguments for binding
	 */
	arguments: object
};
export type QUEUE_UNBIND = {
	/**
	 * @doc
	 * Specifies the name of the queue to unbind.
	 * @rule
	 * + @name queue-known
	 * + @doc
	 * + The client MUST either specify a queue name or have previously declared a
	 * + queue on the same channel
	 * + @scenario
	 * + The client opens a channel and attempts to unbind an unnamed queue.
	 * + @on-failure
	 * + not-found
	 * @rule
	 * + @name must-exist
	 * + @doc
	 * + The client MUST NOT attempt to unbind a queue that does not exist.
	 * + @scenario
	 * + The client attempts to unbind a non-existent queue.
	 * + @on-failure
	 * + not-found
	 */
	queue: string,
	/**
	 * @doc
	 * The name of the exchange to unbind from.
	 * @rule
	 * + @name must-exist
	 * + @doc
	 * + The client MUST NOT attempt to unbind a queue from an exchange that
	 * + does not exist.
	 * + @scenario
	 * + The client attempts to unbind a queue from a non-existent exchange.
	 * + @on-failure
	 * + not-found
	 * @rule
	 * + @name default-exchange
	 * + @doc
	 * + The server MUST accept a blank exchange name to mean the default exchange.
	 * + @scenario
	 * + The client declares a queue and binds it to a blank exchange name.
	 */
	exchange: string,
	/**
	 * @doc
	 * Specifies the routing key of the binding to unbind.
	 * @label
	 * routing key of binding
	 */
	routing_key: string,
	/**
	 * @doc
	 * Specifies the arguments of the binding to unbind.
	 * @label
	 * arguments of binding
	 */
	arguments: object
};
export type QUEUE_PURGE = {
	/**
	 * @doc
	 * Specifies the name of the queue to purge.
	 * @rule
	 * + @name queue-known
	 * + @doc
	 * + The client MUST either specify a queue name or have previously declared a
	 * + queue on the same channel
	 * + @scenario
	 * + The client opens a channel and attempts to purge an unnamed queue.
	 * + @on-failure
	 * + not-found
	 * @rule
	 * + @name must-exist
	 * + @doc
	 * + The client MUST NOT attempt to purge a queue that does not exist.
	 * + @scenario
	 * + The client attempts to purge a non-existent queue.
	 * + @on-failure
	 * + not-found
	 */
	queue: string,
	no_wait: boolean
};
export type QUEUE_PURGE_OK = {
	/**
	 * @doc
	 * Reports the number of messages purged.
	 */
	message_count: number
};
export type QUEUE_DELETE = {
	/**
	 * @doc
	 * Specifies the name of the queue to delete.
	 * @rule
	 * + @name queue-known
	 * + @doc
	 * + The client MUST either specify a queue name or have previously declared a
	 * + queue on the same channel
	 * + @scenario
	 * + The client opens a channel and attempts to delete an unnamed queue.
	 * + @on-failure
	 * + not-found
	 * @rule
	 * + @name must-exist
	 * + @doc
	 * + The client MUST NOT attempt to delete a queue that does not exist.
	 * + @scenario
	 * + The client attempts to delete a non-existent queue.
	 * + @on-failure
	 * + not-found
	 */
	queue: string,
	/**
	 * @doc
	 * If set, the server will only delete the queue if it has no consumers. If the
	 * queue has consumers the server does does not delete it but raises a channel
	 * exception instead.
	 * @label
	 * delete only if unused
	 * @rule
	 * + @name in-use
	 * + @doc
	 * + The server MUST NOT delete a queue that has consumers on it, if the if-unused
	 * + field is true.
	 * + @scenario
	 * + The client declares a queue, and consumes from it, then tries to delete it
	 * + setting if-unused to true.
	 * + @on-failure
	 * + precondition-failed
	 */
	if_unused: boolean,
	/**
	 * @doc
	 * If set, the server will only delete the queue if it has no messages.
	 * @label
	 * delete only if empty
	 * @rule
	 * + @name not-empty
	 * + @doc
	 * + The server MUST NOT delete a queue that has messages on it, if the
	 * + if-empty field is true.
	 * + @scenario
	 * + The client declares a queue, binds it and publishes some messages into it,
	 * + then tries to delete it setting if-empty to true.
	 * + @on-failure
	 * + precondition-failed
	 */
	if_empty: boolean,
	no_wait: boolean
};
export type QUEUE_DELETE_OK = {
	/**
	 * @doc
	 * Reports the number of messages deleted.
	 */
	message_count: number
};
export type BASIC_PROPERTIES = Partial<{
	/**
	 * @comment
	 * These are the properties for a Basic content
	 * @comment
	 * MIME typing
	 * @label
	 * MIME content type
	 */
	content_type: string,
	/**
	 * @comment
	 * MIME typing
	 * @label
	 * MIME content encoding
	 */
	content_encoding: string,
	/**
	 * @comment
	 * For applications, and for header exchange routing
	 * @label
	 * message header field table
	 */
	headers: object,
	/**
	 * @comment
	 * For queues that implement persistence
	 * @label
	 * non-persistent (1) or persistent (2)
	 */
	delivery_mode: number,
	/**
	 * @comment
	 * For queues that implement priorities
	 * @label
	 * message priority, 0 to 9
	 */
	priority: number,
	/**
	 * @comment
	 * For application use, no formal behaviour
	 * @label
	 * application correlation identifier
	 */
	correlation_id: string,
	/**
	 * @comment
	 * For application use, no formal behaviour but may hold the
	 * name of a private response queue, when used in request messages
	 * @label
	 * address to reply to
	 */
	reply_to: string,
	/**
	 * @comment
	 * For implementation use, no formal behaviour
	 * @label
	 * message expiration specification
	 */
	expiration: string,
	/**
	 * @comment
	 * For application use, no formal behaviour
	 * @label
	 * application message identifier
	 */
	message_id: string,
	/**
	 * @comment
	 * For application use, no formal behaviour
	 * @label
	 * message timestamp
	 */
	timestamp: Date,
	/**
	 * @comment
	 * For application use, no formal behaviour
	 * @label
	 * message type name
	 */
	type: string,
	/**
	 * @comment
	 * For application use, no formal behaviour
	 * @label
	 * creating user id
	 */
	user_id: string,
	/**
	 * @comment
	 * For application use, no formal behaviour
	 * @label
	 * creating application id
	 */
	app_id: string,
	/**
	 * @comment
	 * Deprecated, was old cluster-id property
	 * @label
	 * reserved, must be empty
	 */
}>;
export type BASIC_QOS = {
	/**
	 * @doc
	 * The client can request that messages be sent in advance so that when the client
	 * finishes processing a message, the following message is already held locally,
	 * rather than needing to be sent down the channel. Prefetching gives a performance
	 * improvement. This field specifies the prefetch window size in octets. The server
	 * will send a message in advance if it is equal to or smaller in size than the
	 * available prefetch size (and also falls into other prefetch limits). May be set
	 * to zero, meaning "no specific limit", although other prefetch limits may still
	 * apply. The prefetch-size is ignored if the no-ack option is set.
	 * @label
	 * prefetch window in octets
	 * @rule
	 * + @name 1
	 * + @doc
	 * + The server MUST ignore this setting when the client is not processing any
	 * + messages - i.e. the prefetch size does not limit the transfer of single
	 * + messages to a client, only the sending in advance of more messages while
	 * + the client still has one or more unacknowledged messages.
	 * + @scenario
	 * + Define a QoS prefetch-size limit and send a single message that exceeds
	 * + that limit.  Verify that the message arrives correctly.
	 */
	prefetch_size: number,
	/**
	 * @doc
	 * Specifies a prefetch window in terms of whole messages. This field may be used
	 * in combination with the prefetch-size field; a message will only be sent in
	 * advance if both prefetch windows (and those at the channel and connection level)
	 * allow it. The prefetch-count is ignored if the no-ack option is set.
	 * @label
	 * prefetch window in messages
	 * @rule
	 * + @name 1
	 * + @doc
	 * + The server may send less data in advance than allowed by the client's
	 * + specified prefetch windows but it MUST NOT send more.
	 * + @scenario
	 * + Define a QoS prefetch-size limit and a prefetch-count limit greater than
	 * + one.  Send multiple messages that exceed the prefetch size.  Verify that
	 * + no more than one message arrives at once.
	 */
	prefetch_count: number,
	/**
	 * @doc
	 * RabbitMQ has reinterpreted this field. The original
	 * specification said: "By default the QoS settings apply to
	 * the current channel only. If this field is set, they are
	 * applied to the entire connection." Instead, RabbitMQ takes
	 * global=false to mean that the QoS settings should apply
	 * per-consumer (for new consumers on the channel; existing
	 * ones being unaffected) and global=true to mean that the QoS
	 * settings should apply per-channel.
	 * @label
	 * apply to entire connection
	 */
	global: boolean
};
export type BASIC_CONSUME = {
	/**
	 * @doc
	 * Specifies the name of the queue to consume from.
	 */
	queue: string,
	/**
	 * @doc
	 * Specifies the identifier for the consumer. The consumer tag is local to a
	 * channel, so two clients can use the same consumer tags. If this field is
	 * empty the server will generate a unique tag.
	 * @rule
	 * + @name 1
	 * + @doc
	 * + The client MUST NOT specify a tag that refers to an existing consumer.
	 * + @scenario
	 * + Attempt to create two consumers with the same non-empty tag, on the
	 * + same channel.
	 * + @on-failure
	 * + not-allowed
	 * @rule
	 * + @name 2
	 * + @doc
	 * + The consumer tag is valid only within the channel from which the
	 * + consumer was created. I.e. a client MUST NOT create a consumer in one
	 * + channel and then use it in another.
	 * + @scenario
	 * + Attempt to create a consumer in one channel, then use in another channel,
	 * + in which consumers have also been created (to test that the server uses
	 * + unique consumer tags).
	 * + @on-failure
	 * + not-allowed
	 */
	consumer_tag: string,
	no_local: boolean,
	no_ack: boolean,
	/**
	 * @doc
	 * Request exclusive consumer access, meaning only this consumer can access the
	 * queue.
	 * @label
	 * request exclusive access
	 * @rule
	 * + @name 1
	 * + @doc
	 * + The client MAY NOT gain exclusive access to a queue that already has
	 * + active consumers.
	 * + @scenario
	 * + Open two connections to a server, and in one connection declare a shared
	 * + (non-exclusive) queue and then consume from the queue.  In the second
	 * + connection attempt to consume from the same queue using the exclusive
	 * + option.
	 * + @on-failure
	 * + access-refused
	 */
	exclusive: boolean,
	no_wait: boolean,
	/**
	 * @doc
	 * A set of arguments for the consume. The syntax and semantics of these
	 * arguments depends on the server implementation.
	 * @label
	 * arguments for declaration
	 */
	arguments: object
};
export type BASIC_CONSUME_OK = {
	/**
	 * @doc
	 * Holds the consumer tag specified by the client or provided by the server.
	 */
	consumer_tag: string
};
export type BASIC_CANCEL = {
	consumer_tag: string,
	no_wait: boolean
};
export type BASIC_CANCEL_OK = {
	consumer_tag: string
};
export type BASIC_PUBLISH = {
	/**
	 * @doc
	 * Specifies the name of the exchange to publish to. The exchange name can be
	 * empty, meaning the default exchange. If the exchange name is specified, and that
	 * exchange does not exist, the server will raise a channel exception.
	 * @rule
	 * + @name must-exist
	 * + @doc
	 * + The client MUST NOT attempt to publish a content to an exchange that
	 * + does not exist.
	 * + @scenario
	 * + The client attempts to publish a content to a non-existent exchange.
	 * + @on-failure
	 * + not-found
	 * @rule
	 * + @name default-exchange
	 * + @doc
	 * + The server MUST accept a blank exchange name to mean the default exchange.
	 * + @scenario
	 * + The client declares a queue and binds it to a blank exchange name.
	 * @rule
	 * + @name 2
	 * + @doc
	 * + If the exchange was declared as an internal exchange, the server MUST raise
	 * + a channel exception with a reply code 403 (access refused).
	 * + @scenario
	 * + TODO.
	 * @rule
	 * + @name 3
	 * + @doc
	 * + The exchange MAY refuse basic content in which case it MUST raise a channel
	 * + exception with reply code 540 (not implemented).
	 * + @scenario
	 * + TODO.
	 */
	exchange: string,
	/**
	 * @doc
	 * Specifies the routing key for the message. The routing key is used for routing
	 * messages depending on the exchange configuration.
	 * @label
	 * Message routing key
	 */
	routing_key: string,
	/**
	 * @doc
	 * This flag tells the server how to react if the message cannot be routed to a
	 * queue. If this flag is set, the server will return an unroutable message with a
	 * Return method. If this flag is zero, the server silently drops the message.
	 * @label
	 * indicate mandatory routing
	 * @rule
	 * + @name 1
	 * + @doc
	 * + The server SHOULD implement the mandatory flag.
	 * + @scenario
	 * + TODO.
	 */
	mandatory: boolean,
	/**
	 * @doc
	 * This flag tells the server how to react if the message cannot be routed to a
	 * queue consumer immediately. If this flag is set, the server will return an
	 * undeliverable message with a Return method. If this flag is zero, the server
	 * will queue the message, but with no guarantee that it will ever be consumed.
	 * @label
	 * request immediate delivery
	 * @rule
	 * + @name 1
	 * + @doc
	 * + The server SHOULD implement the immediate flag.
	 * + @scenario
	 * + TODO.
	 */
	immediate: boolean
};
export type BASIC_RETURN = {
	reply_code: number,
	reply_text: string,
	/**
	 * @doc
	 * Specifies the name of the exchange that the message was originally published
	 * to.  May be empty, meaning the default exchange.
	 */
	exchange: string,
	/**
	 * @doc
	 * Specifies the routing key name specified when the message was published.
	 * @label
	 * Message routing key
	 */
	routing_key: string
};
export type BASIC_DELIVER = {
	consumer_tag: string,
	delivery_tag: bigint,
	redelivered: boolean,
	/**
	 * @doc
	 * Specifies the name of the exchange that the message was originally published to.
	 * May be empty, indicating the default exchange.
	 */
	exchange: string,
	/**
	 * @doc
	 * Specifies the routing key name specified when the message was published.
	 * @label
	 * Message routing key
	 */
	routing_key: string
};
export type BASIC_GET = {
	/**
	 * @doc
	 * Specifies the name of the queue to get a message from.
	 */
	queue: string,
	no_ack: boolean
};
export type BASIC_GET_OK = {
	delivery_tag: bigint,
	redelivered: boolean,
	/**
	 * @doc
	 * Specifies the name of the exchange that the message was originally published to.
	 * If empty, the message was published to the default exchange.
	 */
	exchange: string,
	/**
	 * @doc
	 * Specifies the routing key name specified when the message was published.
	 * @label
	 * Message routing key
	 */
	routing_key: string,
	message_count: number
};
export type BASIC_ACK = {
	delivery_tag: bigint,
	/**
	 * @doc
	 * If set to 1, the delivery tag is treated as "up to and
	 * including", so that multiple messages can be acknowledged
	 * with a single method. If set to zero, the delivery tag
	 * refers to a single message. If the multiple field is 1, and
	 * the delivery tag is zero, this indicates acknowledgement of
	 * all outstanding messages.
	 * @label
	 * acknowledge multiple messages
	 * @rule
	 * + @name exists
	 * + @doc
	 * + A message MUST not be acknowledged more than once.  The
	 * + receiving peer MUST validate that a non-zero delivery-tag
	 * + refers to a delivered message, and raise a channel
	 * + exception if this is not the case. On a transacted
	 * + channel, this check MUST be done immediately and not
	 * + delayed until a Tx.Commit.
	 * + @scenario
	 * + TODO.
	 * + @on-failure
	 * + precondition-failed
	 */
	multiple: boolean
};
export type BASIC_REJECT = {
	delivery_tag: bigint,
	/**
	 * @doc
	 * If requeue is true, the server will attempt to requeue the message.  If requeue
	 * is false or the requeue  attempt fails the messages are discarded or dead-lettered.
	 * @label
	 * requeue the message
	 * @rule
	 * + @name 1
	 * + @doc
	 * + The server MUST NOT deliver the message to the same client within the
	 * + context of the current channel. The recommended strategy is to attempt to
	 * + deliver the message to an alternative consumer, and if that is not possible,
	 * + to move the message to a dead-letter queue. The server MAY use more
	 * + sophisticated tracking to hold the message on the queue and redeliver it to
	 * + the same client at a later stage.
	 * + @scenario
	 * + TODO.
	 */
	requeue: boolean
};
export type BASIC_RECOVER_ASYNC = {
	/**
	 * @doc
	 * If this field is zero, the message will be redelivered to the original
	 * recipient. If this bit is 1, the server will attempt to requeue the message,
	 * potentially then delivering it to an alternative subscriber.
	 * @label
	 * requeue the message
	 */
	requeue: boolean
};
export type BASIC_RECOVER = {
	/**
	 * @doc
	 * If this field is zero, the message will be redelivered to the original
	 * recipient. If this bit is 1, the server will attempt to requeue the message,
	 * potentially then delivering it to an alternative subscriber.
	 * @label
	 * requeue the message
	 */
	requeue: boolean
};
export type BASIC_NACK = {
	delivery_tag: bigint,
	/**
	 * @doc
	 * If set to 1, the delivery tag is treated as "up to and
	 * including", so that multiple messages can be rejected
	 * with a single method. If set to zero, the delivery tag
	 * refers to a single message. If the multiple field is 1, and
	 * the delivery tag is zero, this indicates rejection of
	 * all outstanding messages.
	 * @label
	 * reject multiple messages
	 * @rule
	 * + @name exists
	 * + @doc
	 * + A message MUST not be rejected more than once.  The
	 * + receiving peer MUST validate that a non-zero delivery-tag
	 * + refers to an unacknowledged, delivered message, and
	 * + raise a channel exception if this is not the case.
	 * + @scenario
	 * + TODO.
	 * + @on-failure
	 * + precondition-failed
	 */
	multiple: boolean,
	/**
	 * @doc
	 * If requeue is true, the server will attempt to requeue the message.  If requeue
	 * is false or the requeue  attempt fails the messages are discarded or dead-lettered.
	 * Clients receiving the Nack methods should ignore this flag.
	 * @label
	 * requeue the message
	 * @rule
	 * + @name 1
	 * + @doc
	 * + The server MUST NOT deliver the message to the same client within the
	 * + context of the current channel. The recommended strategy is to attempt to
	 * + deliver the message to an alternative consumer, and if that is not possible,
	 * + to move the message to a dead-letter queue. The server MAY use more
	 * + sophisticated tracking to hold the message on the queue and redeliver it to
	 * + the same client at a later stage.
	 * + @scenario
	 * + TODO.
	 */
	requeue: boolean
};
export type CONFIRM_SELECT = {
	nowait: boolean
};
export const DECODERS = new Map<number, (reader: BufferReader, path: string)=>any>([
	/** connection_start */
	[655370, (reader, path)=>{
		const value = {} as CONNECTION_START;
		value.version_major = reader.uint8(`${path}.version_major`);
		value.version_minor = reader.uint8(`${path}.version_minor`);
		value.server_properties = reader.table(`${path}.server_properties`);
		value.mechanisms = reader.longstr(`${path}.mechanisms`);
		ASSERTS.notnull(`${path}.mechanisms`, value.mechanisms);
		value.locales = reader.longstr(`${path}.locales`);
		ASSERTS.notnull(`${path}.locales`, value.locales);
		return value;
	}],
	/** connection_start_ok */
	[655371, (reader, path)=>{
		const value = {} as CONNECTION_START_OK;
		value.client_properties = reader.table(`${path}.client_properties`);
		value.mechanism = reader.shortstr(`${path}.mechanism`);
		ASSERTS.notnull(`${path}.mechanism`, value.mechanism);
		value.response = reader.longstr(`${path}.response`);
		ASSERTS.notnull(`${path}.response`, value.response);
		value.locale = reader.shortstr(`${path}.locale`);
		ASSERTS.notnull(`${path}.locale`, value.locale);
		return value;
	}],
	/** connection_secure */
	[655380, (reader, path)=>{
		const value = {} as CONNECTION_SECURE;
		value.challenge = reader.longstr(`${path}.challenge`);
		return value;
	}],
	/** connection_secure_ok */
	[655381, (reader, path)=>{
		const value = {} as CONNECTION_SECURE_OK;
		value.response = reader.longstr(`${path}.response`);
		ASSERTS.notnull(`${path}.response`, value.response);
		return value;
	}],
	/** connection_tune */
	[655390, (reader, path)=>{
		const value = {} as CONNECTION_TUNE;
		value.channel_max = reader.uint16(`${path}.channel_max`);
		value.frame_max = reader.uint32(`${path}.frame_max`);
		value.heartbeat = reader.uint16(`${path}.heartbeat`);
		return value;
	}],
	/** connection_tune_ok */
	[655391, (reader, path)=>{
		const value = {} as CONNECTION_TUNE_OK;
		value.channel_max = reader.uint16(`${path}.channel_max`);
		ASSERTS.notnull(`${path}.channel_max`, value.channel_max);
		value.frame_max = reader.uint32(`${path}.frame_max`);
		value.heartbeat = reader.uint16(`${path}.heartbeat`);
		return value;
	}],
	/** connection_open */
	[655400, (reader, path)=>{
		const value = {} as CONNECTION_OPEN;
		value.virtual_host = reader.shortstr(`${path}.virtual_host`);
		ASSERTS.notnull(`${path}.virtual_host`, value.virtual_host);
		ASSERTS.length(`${path}.virtual_host`, value.virtual_host);
		reader.skip(1);
		reader.skip(1);
		return value;
	}],
	/** connection_open_ok, reserved only */
	[655401, (reader)=>{
		reader.skip(1);
		return null;
	}],
	/** connection_close */
	[655410, (reader, path)=>{
		const value = {} as CONNECTION_CLOSE;
		value.reply_code = reader.uint16(`${path}.reply_code`);
		ASSERTS.notnull(`${path}.reply_code`, value.reply_code);
		value.reply_text = reader.shortstr(`${path}.reply_text`);
		ASSERTS.notnull(`${path}.reply_text`, value.reply_text);
		value.method_id = reader.uint32(`${path}.method_id`);
		return value;
	}],
	/** connection_close_ok */
	[655411, ()=>null],
	/** connection_blocked */
	[655420, (reader, path)=>{
		const value = {} as CONNECTION_BLOCKED;
		value.reason = reader.shortstr(`${path}.reason`);
		return value;
	}],
	/** connection_unblocked */
	[655421, ()=>null],
	/** connection_update_secret */
	[655430, (reader, path)=>{
		const value = {} as CONNECTION_UPDATE_SECRET;
		value.new_secret = reader.longstr(`${path}.new_secret`);
		value.reason = reader.shortstr(`${path}.reason`);
		return value;
	}],
	/** connection_update_secret_ok */
	[655431, ()=>null],
	/** channel_open, reserved only */
	[1310730, (reader)=>{
		reader.skip(1);
		return null;
	}],
	/** channel_open_ok, reserved only */
	[1310731, (reader)=>{
		reader.skip(4);
		return null;
	}],
	/** channel_flow */
	[1310740, (reader, path)=>{
		const value = {} as CHANNEL_FLOW;
		value.active = reader.boolean(`${path}.active`);
		return value;
	}],
	/** channel_flow_ok */
	[1310741, (reader, path)=>{
		const value = {} as CHANNEL_FLOW_OK;
		value.active = reader.boolean(`${path}.active`);
		return value;
	}],
	/** channel_close */
	[1310760, (reader, path)=>{
		const value = {} as CHANNEL_CLOSE;
		value.reply_code = reader.uint16(`${path}.reply_code`);
		ASSERTS.notnull(`${path}.reply_code`, value.reply_code);
		value.reply_text = reader.shortstr(`${path}.reply_text`);
		ASSERTS.notnull(`${path}.reply_text`, value.reply_text);
		value.method_id = reader.uint32(`${path}.method_id`);
		return value;
	}],
	/** channel_close_ok */
	[1310761, ()=>null],
	/** exchange_declare */
	[2621450, (reader, path)=>{
		const value = {} as EXCHANGE_DECLARE;
		reader.skip(2);
		value.exchange = reader.shortstr(`${path}.exchange`);
		ASSERTS.notnull(`${path}.exchange`, value.exchange);
		ASSERTS.length(`${path}.exchange`, value.exchange);
		ASSERTS.regexp(`${path}.exchange`, value.exchange);
		value.type = reader.shortstr(`${path}.type`);
		const flag = reader.uint8(path + ".flag");
		value.passive = !!(flag & 1);
		value.durable = !!(flag & 2);
		value.auto_delete = !!(flag & 4);
		value.internal = !!(flag & 8);
		value.no_wait = !!(flag & 16);
		value.arguments = reader.table(`${path}.arguments`);
		return value;
	}],
	/** exchange_declare_ok */
	[2621451, ()=>null],
	/** exchange_delete */
	[2621460, (reader, path)=>{
		const value = {} as EXCHANGE_DELETE;
		reader.skip(2);
		value.exchange = reader.shortstr(`${path}.exchange`);
		ASSERTS.notnull(`${path}.exchange`, value.exchange);
		ASSERTS.length(`${path}.exchange`, value.exchange);
		ASSERTS.regexp(`${path}.exchange`, value.exchange);
		const flag = reader.uint8(path + ".flag");
		value.if_unused = !!(flag & 1);
		value.no_wait = !!(flag & 2);
		return value;
	}],
	/** exchange_delete_ok */
	[2621461, ()=>null],
	/** exchange_bind */
	[2621470, (reader, path)=>{
		const value = {} as EXCHANGE_BIND;
		reader.skip(2);
		value.destination = reader.shortstr(`${path}.destination`);
		ASSERTS.length(`${path}.destination`, value.destination);
		ASSERTS.regexp(`${path}.destination`, value.destination);
		value.source = reader.shortstr(`${path}.source`);
		ASSERTS.length(`${path}.source`, value.source);
		ASSERTS.regexp(`${path}.source`, value.source);
		value.routing_key = reader.shortstr(`${path}.routing_key`);
		value.no_wait = reader.boolean(`${path}.no_wait`);
		value.arguments = reader.table(`${path}.arguments`);
		return value;
	}],
	/** exchange_bind_ok */
	[2621471, ()=>null],
	/** exchange_unbind */
	[2621480, (reader, path)=>{
		const value = {} as EXCHANGE_UNBIND;
		reader.skip(2);
		value.destination = reader.shortstr(`${path}.destination`);
		ASSERTS.length(`${path}.destination`, value.destination);
		ASSERTS.regexp(`${path}.destination`, value.destination);
		value.source = reader.shortstr(`${path}.source`);
		ASSERTS.length(`${path}.source`, value.source);
		ASSERTS.regexp(`${path}.source`, value.source);
		value.routing_key = reader.shortstr(`${path}.routing_key`);
		value.no_wait = reader.boolean(`${path}.no_wait`);
		value.arguments = reader.table(`${path}.arguments`);
		return value;
	}],
	/** exchange_unbind_ok */
	[2621491, ()=>null],
	/** queue_declare */
	[3276810, (reader, path)=>{
		const value = {} as QUEUE_DECLARE;
		reader.skip(2);
		value.queue = reader.shortstr(`${path}.queue`);
		ASSERTS.length(`${path}.queue`, value.queue);
		ASSERTS.regexp(`${path}.queue`, value.queue);
		const flag = reader.uint8(path + ".flag");
		value.passive = !!(flag & 1);
		value.durable = !!(flag & 2);
		value.exclusive = !!(flag & 4);
		value.auto_delete = !!(flag & 8);
		value.no_wait = !!(flag & 16);
		value.arguments = reader.table(`${path}.arguments`);
		return value;
	}],
	/** queue_declare_ok */
	[3276811, (reader, path)=>{
		const value = {} as QUEUE_DECLARE_OK;
		value.queue = reader.shortstr(`${path}.queue`);
		ASSERTS.notnull(`${path}.queue`, value.queue);
		ASSERTS.length(`${path}.queue`, value.queue);
		ASSERTS.regexp(`${path}.queue`, value.queue);
		value.message_count = reader.uint32(`${path}.message_count`);
		value.consumer_count = reader.uint32(`${path}.consumer_count`);
		return value;
	}],
	/** queue_bind */
	[3276820, (reader, path)=>{
		const value = {} as QUEUE_BIND;
		reader.skip(2);
		value.queue = reader.shortstr(`${path}.queue`);
		ASSERTS.length(`${path}.queue`, value.queue);
		ASSERTS.regexp(`${path}.queue`, value.queue);
		value.exchange = reader.shortstr(`${path}.exchange`);
		ASSERTS.length(`${path}.exchange`, value.exchange);
		ASSERTS.regexp(`${path}.exchange`, value.exchange);
		value.routing_key = reader.shortstr(`${path}.routing_key`);
		value.no_wait = reader.boolean(`${path}.no_wait`);
		value.arguments = reader.table(`${path}.arguments`);
		return value;
	}],
	/** queue_bind_ok */
	[3276821, ()=>null],
	/** queue_unbind */
	[3276850, (reader, path)=>{
		const value = {} as QUEUE_UNBIND;
		reader.skip(2);
		value.queue = reader.shortstr(`${path}.queue`);
		ASSERTS.length(`${path}.queue`, value.queue);
		ASSERTS.regexp(`${path}.queue`, value.queue);
		value.exchange = reader.shortstr(`${path}.exchange`);
		ASSERTS.length(`${path}.exchange`, value.exchange);
		ASSERTS.regexp(`${path}.exchange`, value.exchange);
		value.routing_key = reader.shortstr(`${path}.routing_key`);
		value.arguments = reader.table(`${path}.arguments`);
		return value;
	}],
	/** queue_unbind_ok */
	[3276851, ()=>null],
	/** queue_purge */
	[3276830, (reader, path)=>{
		const value = {} as QUEUE_PURGE;
		reader.skip(2);
		value.queue = reader.shortstr(`${path}.queue`);
		ASSERTS.length(`${path}.queue`, value.queue);
		ASSERTS.regexp(`${path}.queue`, value.queue);
		value.no_wait = reader.boolean(`${path}.no_wait`);
		return value;
	}],
	/** queue_purge_ok */
	[3276831, (reader, path)=>{
		const value = {} as QUEUE_PURGE_OK;
		value.message_count = reader.uint32(`${path}.message_count`);
		return value;
	}],
	/** queue_delete */
	[3276840, (reader, path)=>{
		const value = {} as QUEUE_DELETE;
		reader.skip(2);
		value.queue = reader.shortstr(`${path}.queue`);
		ASSERTS.length(`${path}.queue`, value.queue);
		ASSERTS.regexp(`${path}.queue`, value.queue);
		const flag = reader.uint8(path + ".flag");
		value.if_unused = !!(flag & 1);
		value.if_empty = !!(flag & 2);
		value.no_wait = !!(flag & 4);
		return value;
	}],
	/** queue_delete_ok */
	[3276841, (reader, path)=>{
		const value = {} as QUEUE_DELETE_OK;
		value.message_count = reader.uint32(`${path}.message_count`);
		return value;
	}],
	/** basic_properties */
	[60, (reader, path)=>{
		const value = {} as BASIC_PROPERTIES;
		const flag = reader.uint16(path + ".flag");
		if (!flag) return value;
		if (flag & 32768) value.content_type = reader.shortstr(path + ".content_type");
		if (flag & 16384) value.content_encoding = reader.shortstr(path + ".content_encoding");
		if (flag & 8192) value.headers = reader.table(path + ".headers");
		if (flag & 4096) value.delivery_mode = reader.uint8(path + ".delivery_mode");
		if (flag & 2048) value.priority = reader.uint8(path + ".priority");
		if (flag & 1024) value.correlation_id = reader.shortstr(path + ".correlation_id");
		if (flag & 512) value.reply_to = reader.shortstr(path + ".reply_to");
		if (flag & 256) value.expiration = reader.shortstr(path + ".expiration");
		if (flag & 128) value.message_id = reader.shortstr(path + ".message_id");
		if (flag & 64) value.timestamp = reader.timestamp(path + ".timestamp");
		if (flag & 32) value.type = reader.shortstr(path + ".type");
		if (flag & 16) value.user_id = reader.shortstr(path + ".user_id");
		if (flag & 8) value.app_id = reader.shortstr(path + ".app_id");
		return value;
	}],
	/** basic_qos */
	[3932170, (reader, path)=>{
		const value = {} as BASIC_QOS;
		value.prefetch_size = reader.uint32(`${path}.prefetch_size`);
		value.prefetch_count = reader.uint16(`${path}.prefetch_count`);
		value.global = reader.boolean(`${path}.global`);
		return value;
	}],
	/** basic_qos_ok */
	[3932171, ()=>null],
	/** basic_consume */
	[3932180, (reader, path)=>{
		const value = {} as BASIC_CONSUME;
		reader.skip(2);
		value.queue = reader.shortstr(`${path}.queue`);
		ASSERTS.length(`${path}.queue`, value.queue);
		ASSERTS.regexp(`${path}.queue`, value.queue);
		value.consumer_tag = reader.shortstr(`${path}.consumer_tag`);
		const flag = reader.uint8(path + ".flag");
		value.no_local = !!(flag & 1);
		value.no_ack = !!(flag & 2);
		value.exclusive = !!(flag & 4);
		value.no_wait = !!(flag & 8);
		value.arguments = reader.table(`${path}.arguments`);
		return value;
	}],
	/** basic_consume_ok */
	[3932181, (reader, path)=>{
		const value = {} as BASIC_CONSUME_OK;
		value.consumer_tag = reader.shortstr(`${path}.consumer_tag`);
		return value;
	}],
	/** basic_cancel */
	[3932190, (reader, path)=>{
		const value = {} as BASIC_CANCEL;
		value.consumer_tag = reader.shortstr(`${path}.consumer_tag`);
		value.no_wait = reader.boolean(`${path}.no_wait`);
		return value;
	}],
	/** basic_cancel_ok */
	[3932191, (reader, path)=>{
		const value = {} as BASIC_CANCEL_OK;
		value.consumer_tag = reader.shortstr(`${path}.consumer_tag`);
		return value;
	}],
	/** basic_publish */
	[3932200, (reader, path)=>{
		const value = {} as BASIC_PUBLISH;
		reader.skip(2);
		value.exchange = reader.shortstr(`${path}.exchange`);
		ASSERTS.length(`${path}.exchange`, value.exchange);
		ASSERTS.regexp(`${path}.exchange`, value.exchange);
		value.routing_key = reader.shortstr(`${path}.routing_key`);
		const flag = reader.uint8(path + ".flag");
		value.mandatory = !!(flag & 1);
		value.immediate = !!(flag & 2);
		return value;
	}],
	/** basic_return */
	[3932210, (reader, path)=>{
		const value = {} as BASIC_RETURN;
		value.reply_code = reader.uint16(`${path}.reply_code`);
		ASSERTS.notnull(`${path}.reply_code`, value.reply_code);
		value.reply_text = reader.shortstr(`${path}.reply_text`);
		ASSERTS.notnull(`${path}.reply_text`, value.reply_text);
		value.exchange = reader.shortstr(`${path}.exchange`);
		ASSERTS.length(`${path}.exchange`, value.exchange);
		ASSERTS.regexp(`${path}.exchange`, value.exchange);
		value.routing_key = reader.shortstr(`${path}.routing_key`);
		return value;
	}],
	/** basic_deliver */
	[3932220, (reader, path)=>{
		const value = {} as BASIC_DELIVER;
		value.consumer_tag = reader.shortstr(`${path}.consumer_tag`);
		value.delivery_tag = reader.uint64(`${path}.delivery_tag`);
		value.redelivered = reader.boolean(`${path}.redelivered`);
		value.exchange = reader.shortstr(`${path}.exchange`);
		ASSERTS.length(`${path}.exchange`, value.exchange);
		ASSERTS.regexp(`${path}.exchange`, value.exchange);
		value.routing_key = reader.shortstr(`${path}.routing_key`);
		return value;
	}],
	/** basic_get */
	[3932230, (reader, path)=>{
		const value = {} as BASIC_GET;
		reader.skip(2);
		value.queue = reader.shortstr(`${path}.queue`);
		ASSERTS.length(`${path}.queue`, value.queue);
		ASSERTS.regexp(`${path}.queue`, value.queue);
		value.no_ack = reader.boolean(`${path}.no_ack`);
		return value;
	}],
	/** basic_get_ok */
	[3932231, (reader, path)=>{
		const value = {} as BASIC_GET_OK;
		value.delivery_tag = reader.uint64(`${path}.delivery_tag`);
		value.redelivered = reader.boolean(`${path}.redelivered`);
		value.exchange = reader.shortstr(`${path}.exchange`);
		ASSERTS.length(`${path}.exchange`, value.exchange);
		ASSERTS.regexp(`${path}.exchange`, value.exchange);
		value.routing_key = reader.shortstr(`${path}.routing_key`);
		value.message_count = reader.uint32(`${path}.message_count`);
		return value;
	}],
	/** basic_get_empty, reserved only */
	[3932232, (reader)=>{
		reader.skip(1);
		return null;
	}],
	/** basic_ack */
	[3932240, (reader, path)=>{
		const value = {} as BASIC_ACK;
		value.delivery_tag = reader.uint64(`${path}.delivery_tag`);
		value.multiple = reader.boolean(`${path}.multiple`);
		return value;
	}],
	/** basic_reject */
	[3932250, (reader, path)=>{
		const value = {} as BASIC_REJECT;
		value.delivery_tag = reader.uint64(`${path}.delivery_tag`);
		value.requeue = reader.boolean(`${path}.requeue`);
		return value;
	}],
	/** basic_recover_async */
	[3932260, (reader, path)=>{
		const value = {} as BASIC_RECOVER_ASYNC;
		value.requeue = reader.boolean(`${path}.requeue`);
		return value;
	}],
	/** basic_recover */
	[3932270, (reader, path)=>{
		const value = {} as BASIC_RECOVER;
		value.requeue = reader.boolean(`${path}.requeue`);
		return value;
	}],
	/** basic_recover_ok */
	[3932271, ()=>null],
	/** basic_nack */
	[3932280, (reader, path)=>{
		const value = {} as BASIC_NACK;
		value.delivery_tag = reader.uint64(`${path}.delivery_tag`);
		const flag = reader.uint8(path + ".flag");
		value.multiple = !!(flag & 1);
		value.requeue = !!(flag & 2);
		return value;
	}],
	/** tx_select */
	[5898250, ()=>null],
	/** tx_select_ok */
	[5898251, ()=>null],
	/** tx_commit */
	[5898260, ()=>null],
	/** tx_commit_ok */
	[5898261, ()=>null],
	/** tx_rollback */
	[5898270, ()=>null],
	/** tx_rollback_ok */
	[5898271, ()=>null],
	/** confirm_select */
	[5570570, (reader, path)=>{
		const value = {} as CONFIRM_SELECT;
		value.nowait = reader.boolean(`${path}.nowait`);
		return value;
	}],
	/** confirm_select_ok */
	[5570571, ()=>null]
]);
export const API = {
	connection_start: async (socket: Socket, value: CONNECTION_START)=>{
		const writer = new BufferWriter(26 + (Object.keys(value.server_properties).length ? FRAME_CONST.frame_min_size : 0) + Buffer.byteLength(value.mechanisms, ENCODING) + Buffer.byteLength(value.locales, ENCODING), true);
		writer.methodstart(0, 0, 655370);
		const path = "arguments";
		writer.uint8(`${path}.version_major`, value.version_major);
		writer.uint8(`${path}.version_minor`, value.version_minor);
		writer.table(`${path}.server_properties`, value.server_properties);
		ASSERTS.notnull(`${path}.mechanisms`, value.mechanisms);
		writer.longstr(`${path}.mechanisms`, value.mechanisms);
		ASSERTS.notnull(`${path}.locales`, value.locales);
		writer.longstr(`${path}.locales`, value.locales);
		writer.frameend();
		writer.setframelength();
		return writeSocket(socket, writer);
	},
	connection_start_ok: async (socket: Socket, value: CONNECTION_START_OK)=>{
		const writer = new BufferWriter(22 + (Object.keys(value.client_properties).length ? FRAME_CONST.frame_min_size : 0) + Buffer.byteLength(value.mechanism, ENCODING) + Buffer.byteLength(value.response, ENCODING) + Buffer.byteLength(value.locale, ENCODING), true);
		writer.methodstart(0, 0, 655371);
		const path = "arguments";
		writer.table(`${path}.client_properties`, value.client_properties);
		ASSERTS.notnull(`${path}.mechanism`, value.mechanism);
		writer.shortstr(`${path}.mechanism`, value.mechanism);
		ASSERTS.notnull(`${path}.response`, value.response);
		writer.longstr(`${path}.response`, value.response);
		ASSERTS.notnull(`${path}.locale`, value.locale);
		writer.shortstr(`${path}.locale`, value.locale);
		writer.frameend();
		writer.setframelength();
		return writeSocket(socket, writer);
	},
	connection_secure: async (socket: Socket, value: CONNECTION_SECURE)=>{
		const frame_size = 16 + Buffer.byteLength(value.challenge, ENCODING);
		const writer = new BufferWriter(frame_size, false);
		writer.methodstart(0, frame_size - EMPTY_FRAME_SIZE, 655380);
		const path = "arguments";
		writer.longstr(`${path}.challenge`, value.challenge);
		writer.frameend();
		return writeSocket(socket, writer);
	},
	connection_secure_ok: async (socket: Socket, value: CONNECTION_SECURE_OK)=>{
		const frame_size = 16 + Buffer.byteLength(value.response, ENCODING);
		const writer = new BufferWriter(frame_size, false);
		writer.methodstart(0, frame_size - EMPTY_FRAME_SIZE, 655381);
		const path = "arguments";
		ASSERTS.notnull(`${path}.response`, value.response);
		writer.longstr(`${path}.response`, value.response);
		writer.frameend();
		return writeSocket(socket, writer);
	},
	connection_tune: async (socket: Socket, value: CONNECTION_TUNE)=>{
		const frame_size = 20;
		const writer = new BufferWriter(frame_size, false);
		writer.methodstart(0, frame_size - EMPTY_FRAME_SIZE, 655390);
		const path = "arguments";
		writer.uint16(`${path}.channel_max`, value.channel_max);
		writer.uint32(`${path}.frame_max`, value.frame_max);
		writer.uint16(`${path}.heartbeat`, value.heartbeat);
		writer.frameend();
		return writeSocket(socket, writer);
	},
	connection_tune_ok: async (socket: Socket, value: CONNECTION_TUNE_OK)=>{
		const frame_size = 20;
		const writer = new BufferWriter(frame_size, false);
		writer.methodstart(0, frame_size - EMPTY_FRAME_SIZE, 655391);
		const path = "arguments";
		ASSERTS.notnull(`${path}.channel_max`, value.channel_max);
		writer.uint16(`${path}.channel_max`, value.channel_max);
		writer.uint32(`${path}.frame_max`, value.frame_max);
		writer.uint16(`${path}.heartbeat`, value.heartbeat);
		writer.frameend();
		return writeSocket(socket, writer);
	},
	connection_open: async (socket: Socket, value: CONNECTION_OPEN)=>{
		const frame_size = 15 + Buffer.byteLength(value.virtual_host, ENCODING);
		const writer = new BufferWriter(frame_size, false);
		writer.methodstart(0, frame_size - EMPTY_FRAME_SIZE, 655400);
		const path = "arguments";
		ASSERTS.notnull(`${path}.virtual_host`, value.virtual_host);
		ASSERTS.length(`${path}.virtual_host`, value.virtual_host);
		writer.shortstr(`${path}.virtual_host`, value.virtual_host);
		writer.skip(1);
		writer.skip(1);
		writer.frameend();
		return writeSocket(socket, writer);
	},
	connection_open_ok: async (socket: Socket)=>{
		const frame_size = 13;
		const writer = new BufferWriter(frame_size, false);
		writer.methodstart(0, frame_size - EMPTY_FRAME_SIZE, 655401);
		writer.skip(1);
		writer.frameend();
		return writeSocket(socket, writer);
	},
	connection_close: async (socket: Socket, value: CONNECTION_CLOSE)=>{
		const frame_size = 19 + Buffer.byteLength(value.reply_text, ENCODING);
		const writer = new BufferWriter(frame_size, false);
		writer.methodstart(0, frame_size - EMPTY_FRAME_SIZE, 655410);
		const path = "arguments";
		ASSERTS.notnull(`${path}.reply_code`, value.reply_code);
		writer.uint16(`${path}.reply_code`, value.reply_code);
		ASSERTS.notnull(`${path}.reply_text`, value.reply_text);
		writer.shortstr(`${path}.reply_text`, value.reply_text);
		writer.uint32(`${path}.method_id`, value.method_id);
		writer.frameend();
		return writeSocket(socket, writer);
	},
	connection_close_ok: (socket: Socket)=>{ return writeVoid(655411, socket, 0); },
	connection_blocked: async (socket: Socket, value: CONNECTION_BLOCKED)=>{
		const frame_size = 13 + Buffer.byteLength(value.reason, ENCODING);
		const writer = new BufferWriter(frame_size, false);
		writer.methodstart(0, frame_size - EMPTY_FRAME_SIZE, 655420);
		const path = "arguments";
		writer.shortstr(`${path}.reason`, value.reason);
		writer.frameend();
		return writeSocket(socket, writer);
	},
	connection_unblocked: (socket: Socket)=>{ return writeVoid(655421, socket, 0); },
	connection_update_secret: async (socket: Socket, value: CONNECTION_UPDATE_SECRET)=>{
		const frame_size = 17 + Buffer.byteLength(value.new_secret, ENCODING) + Buffer.byteLength(value.reason, ENCODING);
		const writer = new BufferWriter(frame_size, false);
		writer.methodstart(0, frame_size - EMPTY_FRAME_SIZE, 655430);
		const path = "arguments";
		writer.longstr(`${path}.new_secret`, value.new_secret);
		writer.shortstr(`${path}.reason`, value.reason);
		writer.frameend();
		return writeSocket(socket, writer);
	},
	connection_update_secret_ok: (socket: Socket)=>{ return writeVoid(655431, socket, 0); },
	channel_open: async (socket: Socket, channel: number)=>{
		const frame_size = 13;
		const writer = new BufferWriter(frame_size, false);
		writer.methodstart(channel, frame_size - EMPTY_FRAME_SIZE, 1310730);
		writer.skip(1);
		writer.frameend();
		return writeSocket(socket, writer);
	},
	channel_open_ok: async (socket: Socket, channel: number)=>{
		const frame_size = 16;
		const writer = new BufferWriter(frame_size, false);
		writer.methodstart(channel, frame_size - EMPTY_FRAME_SIZE, 1310731);
		writer.skip(4);
		writer.frameend();
		return writeSocket(socket, writer);
	},
	channel_flow: async (socket: Socket, channel: number, value: CHANNEL_FLOW)=>{
		const frame_size = 13;
		const writer = new BufferWriter(frame_size, false);
		writer.methodstart(channel, frame_size - EMPTY_FRAME_SIZE, 1310740);
		const path = "arguments";
		writer.boolean(`${path}.active`, value.active);
		writer.frameend();
		return writeSocket(socket, writer);
	},
	channel_flow_ok: async (socket: Socket, channel: number, value: CHANNEL_FLOW_OK)=>{
		const frame_size = 13;
		const writer = new BufferWriter(frame_size, false);
		writer.methodstart(channel, frame_size - EMPTY_FRAME_SIZE, 1310741);
		const path = "arguments";
		writer.boolean(`${path}.active`, value.active);
		writer.frameend();
		return writeSocket(socket, writer);
	},
	channel_close: async (socket: Socket, channel: number, value: CHANNEL_CLOSE)=>{
		const frame_size = 19 + Buffer.byteLength(value.reply_text, ENCODING);
		const writer = new BufferWriter(frame_size, false);
		writer.methodstart(channel, frame_size - EMPTY_FRAME_SIZE, 1310760);
		const path = "arguments";
		ASSERTS.notnull(`${path}.reply_code`, value.reply_code);
		writer.uint16(`${path}.reply_code`, value.reply_code);
		ASSERTS.notnull(`${path}.reply_text`, value.reply_text);
		writer.shortstr(`${path}.reply_text`, value.reply_text);
		writer.uint32(`${path}.method_id`, value.method_id);
		writer.frameend();
		return writeSocket(socket, writer);
	},
	channel_close_ok: (socket: Socket, channel: number)=>{ return writeVoid(1310761, socket, channel); },
	exchange_declare: async (socket: Socket, channel: number, value: EXCHANGE_DECLARE)=>{
		const writer = new BufferWriter(21 + Buffer.byteLength(value.exchange, ENCODING) + Buffer.byteLength(value.type, ENCODING) + (Object.keys(value.arguments).length ? FRAME_CONST.frame_min_size : 0), true);
		writer.methodstart(channel, 0, 2621450);
		const path = "arguments";
		writer.skip(2);
		ASSERTS.notnull(`${path}.exchange`, value.exchange);
		ASSERTS.length(`${path}.exchange`, value.exchange);
		ASSERTS.regexp(`${path}.exchange`, value.exchange);
		writer.shortstr(`${path}.exchange`, value.exchange);
		writer.shortstr(`${path}.type`, value.type);
		let flag = 0;
		if (value.passive) flag = flag | 1;
		if (value.durable) flag = flag | 2;
		if (value.auto_delete) flag = flag | 4;
		if (value.internal) flag = flag | 8;
		if (value.no_wait) flag = flag | 16;
		writer.uint8(path + ".flag", flag);
		writer.table(`${path}.arguments`, value.arguments);
		writer.frameend();
		writer.setframelength();
		return writeSocket(socket, writer);
	},
	exchange_declare_ok: (socket: Socket, channel: number)=>{ return writeVoid(2621451, socket, channel); },
	exchange_delete: async (socket: Socket, channel: number, value: EXCHANGE_DELETE)=>{
		const frame_size = 16 + Buffer.byteLength(value.exchange, ENCODING);
		const writer = new BufferWriter(frame_size, false);
		writer.methodstart(channel, frame_size - EMPTY_FRAME_SIZE, 2621460);
		const path = "arguments";
		writer.skip(2);
		ASSERTS.notnull(`${path}.exchange`, value.exchange);
		ASSERTS.length(`${path}.exchange`, value.exchange);
		ASSERTS.regexp(`${path}.exchange`, value.exchange);
		writer.shortstr(`${path}.exchange`, value.exchange);
		let flag = 0;
		if (value.if_unused) flag = flag | 1;
		if (value.no_wait) flag = flag | 2;
		writer.uint8(path + ".flag", flag);
		writer.frameend();
		return writeSocket(socket, writer);
	},
	exchange_delete_ok: (socket: Socket, channel: number)=>{ return writeVoid(2621461, socket, channel); },
	exchange_bind: async (socket: Socket, channel: number, value: EXCHANGE_BIND)=>{
		const writer = new BufferWriter(22 + Buffer.byteLength(value.destination, ENCODING) + Buffer.byteLength(value.source, ENCODING) + Buffer.byteLength(value.routing_key, ENCODING) + (Object.keys(value.arguments).length ? FRAME_CONST.frame_min_size : 0), true);
		writer.methodstart(channel, 0, 2621470);
		const path = "arguments";
		writer.skip(2);
		ASSERTS.length(`${path}.destination`, value.destination);
		ASSERTS.regexp(`${path}.destination`, value.destination);
		writer.shortstr(`${path}.destination`, value.destination);
		ASSERTS.length(`${path}.source`, value.source);
		ASSERTS.regexp(`${path}.source`, value.source);
		writer.shortstr(`${path}.source`, value.source);
		writer.shortstr(`${path}.routing_key`, value.routing_key);
		writer.boolean(`${path}.no_wait`, value.no_wait);
		writer.table(`${path}.arguments`, value.arguments);
		writer.frameend();
		writer.setframelength();
		return writeSocket(socket, writer);
	},
	exchange_bind_ok: (socket: Socket, channel: number)=>{ return writeVoid(2621471, socket, channel); },
	exchange_unbind: async (socket: Socket, channel: number, value: EXCHANGE_UNBIND)=>{
		const writer = new BufferWriter(22 + Buffer.byteLength(value.destination, ENCODING) + Buffer.byteLength(value.source, ENCODING) + Buffer.byteLength(value.routing_key, ENCODING) + (Object.keys(value.arguments).length ? FRAME_CONST.frame_min_size : 0), true);
		writer.methodstart(channel, 0, 2621480);
		const path = "arguments";
		writer.skip(2);
		ASSERTS.length(`${path}.destination`, value.destination);
		ASSERTS.regexp(`${path}.destination`, value.destination);
		writer.shortstr(`${path}.destination`, value.destination);
		ASSERTS.length(`${path}.source`, value.source);
		ASSERTS.regexp(`${path}.source`, value.source);
		writer.shortstr(`${path}.source`, value.source);
		writer.shortstr(`${path}.routing_key`, value.routing_key);
		writer.boolean(`${path}.no_wait`, value.no_wait);
		writer.table(`${path}.arguments`, value.arguments);
		writer.frameend();
		writer.setframelength();
		return writeSocket(socket, writer);
	},
	exchange_unbind_ok: (socket: Socket, channel: number)=>{ return writeVoid(2621491, socket, channel); },
	queue_declare: async (socket: Socket, channel: number, value: QUEUE_DECLARE)=>{
		const writer = new BufferWriter(20 + Buffer.byteLength(value.queue, ENCODING) + (Object.keys(value.arguments).length ? FRAME_CONST.frame_min_size : 0), true);
		writer.methodstart(channel, 0, 3276810);
		const path = "arguments";
		writer.skip(2);
		ASSERTS.length(`${path}.queue`, value.queue);
		ASSERTS.regexp(`${path}.queue`, value.queue);
		writer.shortstr(`${path}.queue`, value.queue);
		let flag = 0;
		if (value.passive) flag = flag | 1;
		if (value.durable) flag = flag | 2;
		if (value.exclusive) flag = flag | 4;
		if (value.auto_delete) flag = flag | 8;
		if (value.no_wait) flag = flag | 16;
		writer.uint8(path + ".flag", flag);
		writer.table(`${path}.arguments`, value.arguments);
		writer.frameend();
		writer.setframelength();
		return writeSocket(socket, writer);
	},
	queue_declare_ok: async (socket: Socket, channel: number, value: QUEUE_DECLARE_OK)=>{
		const frame_size = 21 + Buffer.byteLength(value.queue, ENCODING);
		const writer = new BufferWriter(frame_size, false);
		writer.methodstart(channel, frame_size - EMPTY_FRAME_SIZE, 3276811);
		const path = "arguments";
		ASSERTS.notnull(`${path}.queue`, value.queue);
		ASSERTS.length(`${path}.queue`, value.queue);
		ASSERTS.regexp(`${path}.queue`, value.queue);
		writer.shortstr(`${path}.queue`, value.queue);
		writer.uint32(`${path}.message_count`, value.message_count);
		writer.uint32(`${path}.consumer_count`, value.consumer_count);
		writer.frameend();
		return writeSocket(socket, writer);
	},
	queue_bind: async (socket: Socket, channel: number, value: QUEUE_BIND)=>{
		const writer = new BufferWriter(22 + Buffer.byteLength(value.queue, ENCODING) + Buffer.byteLength(value.exchange, ENCODING) + Buffer.byteLength(value.routing_key, ENCODING) + (Object.keys(value.arguments).length ? FRAME_CONST.frame_min_size : 0), true);
		writer.methodstart(channel, 0, 3276820);
		const path = "arguments";
		writer.skip(2);
		ASSERTS.length(`${path}.queue`, value.queue);
		ASSERTS.regexp(`${path}.queue`, value.queue);
		writer.shortstr(`${path}.queue`, value.queue);
		ASSERTS.length(`${path}.exchange`, value.exchange);
		ASSERTS.regexp(`${path}.exchange`, value.exchange);
		writer.shortstr(`${path}.exchange`, value.exchange);
		writer.shortstr(`${path}.routing_key`, value.routing_key);
		writer.boolean(`${path}.no_wait`, value.no_wait);
		writer.table(`${path}.arguments`, value.arguments);
		writer.frameend();
		writer.setframelength();
		return writeSocket(socket, writer);
	},
	queue_bind_ok: (socket: Socket, channel: number)=>{ return writeVoid(3276821, socket, channel); },
	queue_unbind: async (socket: Socket, channel: number, value: QUEUE_UNBIND)=>{
		const writer = new BufferWriter(21 + Buffer.byteLength(value.queue, ENCODING) + Buffer.byteLength(value.exchange, ENCODING) + Buffer.byteLength(value.routing_key, ENCODING) + (Object.keys(value.arguments).length ? FRAME_CONST.frame_min_size : 0), true);
		writer.methodstart(channel, 0, 3276850);
		const path = "arguments";
		writer.skip(2);
		ASSERTS.length(`${path}.queue`, value.queue);
		ASSERTS.regexp(`${path}.queue`, value.queue);
		writer.shortstr(`${path}.queue`, value.queue);
		ASSERTS.length(`${path}.exchange`, value.exchange);
		ASSERTS.regexp(`${path}.exchange`, value.exchange);
		writer.shortstr(`${path}.exchange`, value.exchange);
		writer.shortstr(`${path}.routing_key`, value.routing_key);
		writer.table(`${path}.arguments`, value.arguments);
		writer.frameend();
		writer.setframelength();
		return writeSocket(socket, writer);
	},
	queue_unbind_ok: (socket: Socket, channel: number)=>{ return writeVoid(3276851, socket, channel); },
	queue_purge: async (socket: Socket, channel: number, value: QUEUE_PURGE)=>{
		const frame_size = 16 + Buffer.byteLength(value.queue, ENCODING);
		const writer = new BufferWriter(frame_size, false);
		writer.methodstart(channel, frame_size - EMPTY_FRAME_SIZE, 3276830);
		const path = "arguments";
		writer.skip(2);
		ASSERTS.length(`${path}.queue`, value.queue);
		ASSERTS.regexp(`${path}.queue`, value.queue);
		writer.shortstr(`${path}.queue`, value.queue);
		writer.boolean(`${path}.no_wait`, value.no_wait);
		writer.frameend();
		return writeSocket(socket, writer);
	},
	queue_purge_ok: async (socket: Socket, channel: number, value: QUEUE_PURGE_OK)=>{
		const frame_size = 16;
		const writer = new BufferWriter(frame_size, false);
		writer.methodstart(channel, frame_size - EMPTY_FRAME_SIZE, 3276831);
		const path = "arguments";
		writer.uint32(`${path}.message_count`, value.message_count);
		writer.frameend();
		return writeSocket(socket, writer);
	},
	queue_delete: async (socket: Socket, channel: number, value: QUEUE_DELETE)=>{
		const frame_size = 16 + Buffer.byteLength(value.queue, ENCODING);
		const writer = new BufferWriter(frame_size, false);
		writer.methodstart(channel, frame_size - EMPTY_FRAME_SIZE, 3276840);
		const path = "arguments";
		writer.skip(2);
		ASSERTS.length(`${path}.queue`, value.queue);
		ASSERTS.regexp(`${path}.queue`, value.queue);
		writer.shortstr(`${path}.queue`, value.queue);
		let flag = 0;
		if (value.if_unused) flag = flag | 1;
		if (value.if_empty) flag = flag | 2;
		if (value.no_wait) flag = flag | 4;
		writer.uint8(path + ".flag", flag);
		writer.frameend();
		return writeSocket(socket, writer);
	},
	queue_delete_ok: async (socket: Socket, channel: number, value: QUEUE_DELETE_OK)=>{
		const frame_size = 16;
		const writer = new BufferWriter(frame_size, false);
		writer.methodstart(channel, frame_size - EMPTY_FRAME_SIZE, 3276841);
		const path = "arguments";
		writer.uint32(`${path}.message_count`, value.message_count);
		writer.frameend();
		return writeSocket(socket, writer);
	},
	publish_header: async (socket: Socket, channel: number, value: BASIC_PROPERTIES, body_size: number)=>{
		const writer = new BufferWriter(FRAME_CONST.frame_min_size, true);
		writer.headerstart(channel, 60, body_size);
		const path = "properties";
		const flag_offset = writer.offset;
		writer.uint16(path + ".flag", 0);
		if (!Object.keys(value).length) return;
		let flag = 0;
		if ("content_type" in value){
			flag = flag | 32768;
			writer.shortstr(path + ".content_type", value.content_type as string);
		}
		if ("content_encoding" in value){
			flag = flag | 16384;
			writer.shortstr(path + ".content_encoding", value.content_encoding as string);
		}
		if ("headers" in value){
			flag = flag | 8192;
			writer.table(path + ".headers", value.headers as object);
		}
		if ("delivery_mode" in value){
			flag = flag | 4096;
			writer.uint8(path + ".delivery_mode", value.delivery_mode as number);
		}
		if ("priority" in value){
			flag = flag | 2048;
			writer.uint8(path + ".priority", value.priority as number);
		}
		if ("correlation_id" in value){
			flag = flag | 1024;
			writer.shortstr(path + ".correlation_id", value.correlation_id as string);
		}
		if ("reply_to" in value){
			flag = flag | 512;
			writer.shortstr(path + ".reply_to", value.reply_to as string);
		}
		if ("expiration" in value){
			flag = flag | 256;
			writer.shortstr(path + ".expiration", value.expiration as string);
		}
		if ("message_id" in value){
			flag = flag | 128;
			writer.shortstr(path + ".message_id", value.message_id as string);
		}
		if ("timestamp" in value){
			flag = flag | 64;
			writer.timestamp(path + ".timestamp", value.timestamp as Date);
		}
		if ("type" in value){
			flag = flag | 32;
			writer.shortstr(path + ".type", value.type as string);
		}
		if ("user_id" in value){
			flag = flag | 16;
			writer.shortstr(path + ".user_id", value.user_id as string);
		}
		if ("app_id" in value){
			flag = flag | 8;
			writer.shortstr(path + ".app_id", value.app_id as string);
		}
		writer.buffer.writeUInt16BE(flag, flag_offset);
		writer.frameend();
		writer.setframelength();

		await writeSocket(socket, writer);
	},
	basic_qos: async (socket: Socket, channel: number, value: BASIC_QOS)=>{
		const frame_size = 19;
		const writer = new BufferWriter(frame_size, false);
		writer.methodstart(channel, frame_size - EMPTY_FRAME_SIZE, 3932170);
		const path = "arguments";
		writer.uint32(`${path}.prefetch_size`, value.prefetch_size);
		writer.uint16(`${path}.prefetch_count`, value.prefetch_count);
		writer.boolean(`${path}.global`, value.global);
		writer.frameend();
		return writeSocket(socket, writer);
	},
	basic_qos_ok: (socket: Socket, channel: number)=>{ return writeVoid(3932171, socket, channel); },
	basic_consume: async (socket: Socket, channel: number, value: BASIC_CONSUME)=>{
		const writer = new BufferWriter(21 + Buffer.byteLength(value.queue, ENCODING) + Buffer.byteLength(value.consumer_tag, ENCODING) + (Object.keys(value.arguments).length ? FRAME_CONST.frame_min_size : 0), true);
		writer.methodstart(channel, 0, 3932180);
		const path = "arguments";
		writer.skip(2);
		ASSERTS.length(`${path}.queue`, value.queue);
		ASSERTS.regexp(`${path}.queue`, value.queue);
		writer.shortstr(`${path}.queue`, value.queue);
		writer.shortstr(`${path}.consumer_tag`, value.consumer_tag);
		let flag = 0;
		if (value.no_local) flag = flag | 1;
		if (value.no_ack) flag = flag | 2;
		if (value.exclusive) flag = flag | 4;
		if (value.no_wait) flag = flag | 8;
		writer.uint8(path + ".flag", flag);
		writer.table(`${path}.arguments`, value.arguments);
		writer.frameend();
		writer.setframelength();
		return writeSocket(socket, writer);
	},
	basic_consume_ok: async (socket: Socket, channel: number, value: BASIC_CONSUME_OK)=>{
		const frame_size = 13 + Buffer.byteLength(value.consumer_tag, ENCODING);
		const writer = new BufferWriter(frame_size, false);
		writer.methodstart(channel, frame_size - EMPTY_FRAME_SIZE, 3932181);
		const path = "arguments";
		writer.shortstr(`${path}.consumer_tag`, value.consumer_tag);
		writer.frameend();
		return writeSocket(socket, writer);
	},
	basic_cancel: async (socket: Socket, channel: number, value: BASIC_CANCEL)=>{
		const frame_size = 14 + Buffer.byteLength(value.consumer_tag, ENCODING);
		const writer = new BufferWriter(frame_size, false);
		writer.methodstart(channel, frame_size - EMPTY_FRAME_SIZE, 3932190);
		const path = "arguments";
		writer.shortstr(`${path}.consumer_tag`, value.consumer_tag);
		writer.boolean(`${path}.no_wait`, value.no_wait);
		writer.frameend();
		return writeSocket(socket, writer);
	},
	basic_cancel_ok: async (socket: Socket, channel: number, value: BASIC_CANCEL_OK)=>{
		const frame_size = 13 + Buffer.byteLength(value.consumer_tag, ENCODING);
		const writer = new BufferWriter(frame_size, false);
		writer.methodstart(channel, frame_size - EMPTY_FRAME_SIZE, 3932191);
		const path = "arguments";
		writer.shortstr(`${path}.consumer_tag`, value.consumer_tag);
		writer.frameend();
		return writeSocket(socket, writer);
	},
	basic_publish: async (socket: Socket, channel: number, value: BASIC_PUBLISH)=>{
		const frame_size = 17 + Buffer.byteLength(value.exchange, ENCODING) + Buffer.byteLength(value.routing_key, ENCODING);
		const writer = new BufferWriter(frame_size, false);
		writer.methodstart(channel, frame_size - EMPTY_FRAME_SIZE, 3932200);
		const path = "arguments";
		writer.skip(2);
		ASSERTS.length(`${path}.exchange`, value.exchange);
		ASSERTS.regexp(`${path}.exchange`, value.exchange);
		writer.shortstr(`${path}.exchange`, value.exchange);
		writer.shortstr(`${path}.routing_key`, value.routing_key);
		let flag = 0;
		if (value.mandatory) flag = flag | 1;
		if (value.immediate) flag = flag | 2;
		writer.uint8(path + ".flag", flag);
		writer.frameend();
		return writeSocket(socket, writer);
	},
	basic_return: async (socket: Socket, channel: number, value: BASIC_RETURN)=>{
		const frame_size = 17 + Buffer.byteLength(value.reply_text, ENCODING) + Buffer.byteLength(value.exchange, ENCODING) + Buffer.byteLength(value.routing_key, ENCODING);
		const writer = new BufferWriter(frame_size, false);
		writer.methodstart(channel, frame_size - EMPTY_FRAME_SIZE, 3932210);
		const path = "arguments";
		ASSERTS.notnull(`${path}.reply_code`, value.reply_code);
		writer.uint16(`${path}.reply_code`, value.reply_code);
		ASSERTS.notnull(`${path}.reply_text`, value.reply_text);
		writer.shortstr(`${path}.reply_text`, value.reply_text);
		ASSERTS.length(`${path}.exchange`, value.exchange);
		ASSERTS.regexp(`${path}.exchange`, value.exchange);
		writer.shortstr(`${path}.exchange`, value.exchange);
		writer.shortstr(`${path}.routing_key`, value.routing_key);
		writer.frameend();
		return writeSocket(socket, writer);
	},
	basic_deliver: async (socket: Socket, channel: number, value: BASIC_DELIVER)=>{
		const frame_size = 24 + Buffer.byteLength(value.consumer_tag, ENCODING) + Buffer.byteLength(value.exchange, ENCODING) + Buffer.byteLength(value.routing_key, ENCODING);
		const writer = new BufferWriter(frame_size, false);
		writer.methodstart(channel, frame_size - EMPTY_FRAME_SIZE, 3932220);
		const path = "arguments";
		writer.shortstr(`${path}.consumer_tag`, value.consumer_tag);
		writer.uint64(`${path}.delivery_tag`, value.delivery_tag);
		writer.boolean(`${path}.redelivered`, value.redelivered);
		ASSERTS.length(`${path}.exchange`, value.exchange);
		ASSERTS.regexp(`${path}.exchange`, value.exchange);
		writer.shortstr(`${path}.exchange`, value.exchange);
		writer.shortstr(`${path}.routing_key`, value.routing_key);
		writer.frameend();
		return writeSocket(socket, writer);
	},
	basic_get: async (socket: Socket, channel: number, value: BASIC_GET)=>{
		const frame_size = 16 + Buffer.byteLength(value.queue, ENCODING);
		const writer = new BufferWriter(frame_size, false);
		writer.methodstart(channel, frame_size - EMPTY_FRAME_SIZE, 3932230);
		const path = "arguments";
		writer.skip(2);
		ASSERTS.length(`${path}.queue`, value.queue);
		ASSERTS.regexp(`${path}.queue`, value.queue);
		writer.shortstr(`${path}.queue`, value.queue);
		writer.boolean(`${path}.no_ack`, value.no_ack);
		writer.frameend();
		return writeSocket(socket, writer);
	},
	basic_get_ok: async (socket: Socket, channel: number, value: BASIC_GET_OK)=>{
		const frame_size = 27 + Buffer.byteLength(value.exchange, ENCODING) + Buffer.byteLength(value.routing_key, ENCODING);
		const writer = new BufferWriter(frame_size, false);
		writer.methodstart(channel, frame_size - EMPTY_FRAME_SIZE, 3932231);
		const path = "arguments";
		writer.uint64(`${path}.delivery_tag`, value.delivery_tag);
		writer.boolean(`${path}.redelivered`, value.redelivered);
		ASSERTS.length(`${path}.exchange`, value.exchange);
		ASSERTS.regexp(`${path}.exchange`, value.exchange);
		writer.shortstr(`${path}.exchange`, value.exchange);
		writer.shortstr(`${path}.routing_key`, value.routing_key);
		writer.uint32(`${path}.message_count`, value.message_count);
		writer.frameend();
		return writeSocket(socket, writer);
	},
	basic_get_empty: async (socket: Socket, channel: number)=>{
		const frame_size = 13;
		const writer = new BufferWriter(frame_size, false);
		writer.methodstart(channel, frame_size - EMPTY_FRAME_SIZE, 3932232);
		writer.skip(1);
		writer.frameend();
		return writeSocket(socket, writer);
	},
	basic_ack: async (socket: Socket, channel: number, value: BASIC_ACK)=>{
		const frame_size = 21;
		const writer = new BufferWriter(frame_size, false);
		writer.methodstart(channel, frame_size - EMPTY_FRAME_SIZE, 3932240);
		const path = "arguments";
		writer.uint64(`${path}.delivery_tag`, value.delivery_tag);
		writer.boolean(`${path}.multiple`, value.multiple);
		writer.frameend();
		return writeSocket(socket, writer);
	},
	basic_reject: async (socket: Socket, channel: number, value: BASIC_REJECT)=>{
		const frame_size = 21;
		const writer = new BufferWriter(frame_size, false);
		writer.methodstart(channel, frame_size - EMPTY_FRAME_SIZE, 3932250);
		const path = "arguments";
		writer.uint64(`${path}.delivery_tag`, value.delivery_tag);
		writer.boolean(`${path}.requeue`, value.requeue);
		writer.frameend();
		return writeSocket(socket, writer);
	},
	basic_recover_async: async (socket: Socket, channel: number, value: BASIC_RECOVER_ASYNC)=>{
		const frame_size = 13;
		const writer = new BufferWriter(frame_size, false);
		writer.methodstart(channel, frame_size - EMPTY_FRAME_SIZE, 3932260);
		const path = "arguments";
		writer.boolean(`${path}.requeue`, value.requeue);
		writer.frameend();
		return writeSocket(socket, writer);
	},
	basic_recover: async (socket: Socket, channel: number, value: BASIC_RECOVER)=>{
		const frame_size = 13;
		const writer = new BufferWriter(frame_size, false);
		writer.methodstart(channel, frame_size - EMPTY_FRAME_SIZE, 3932270);
		const path = "arguments";
		writer.boolean(`${path}.requeue`, value.requeue);
		writer.frameend();
		return writeSocket(socket, writer);
	},
	basic_recover_ok: (socket: Socket, channel: number)=>{ return writeVoid(3932271, socket, channel); },
	basic_nack: async (socket: Socket, channel: number, value: BASIC_NACK)=>{
		const frame_size = 21;
		const writer = new BufferWriter(frame_size, false);
		writer.methodstart(channel, frame_size - EMPTY_FRAME_SIZE, 3932280);
		const path = "arguments";
		writer.uint64(`${path}.delivery_tag`, value.delivery_tag);
		let flag = 0;
		if (value.multiple) flag = flag | 1;
		if (value.requeue) flag = flag | 2;
		writer.uint8(path + ".flag", flag);
		writer.frameend();
		return writeSocket(socket, writer);
	},
	tx_select: (socket: Socket, channel: number)=>{ return writeVoid(5898250, socket, channel); },
	tx_select_ok: (socket: Socket, channel: number)=>{ return writeVoid(5898251, socket, channel); },
	tx_commit: (socket: Socket, channel: number)=>{ return writeVoid(5898260, socket, channel); },
	tx_commit_ok: (socket: Socket, channel: number)=>{ return writeVoid(5898261, socket, channel); },
	tx_rollback: (socket: Socket, channel: number)=>{ return writeVoid(5898270, socket, channel); },
	tx_rollback_ok: (socket: Socket, channel: number)=>{ return writeVoid(5898271, socket, channel); },
	confirm_select: async (socket: Socket, channel: number, value: CONFIRM_SELECT)=>{
		const frame_size = 13;
		const writer = new BufferWriter(frame_size, false);
		writer.methodstart(channel, frame_size - EMPTY_FRAME_SIZE, 5570570);
		const path = "arguments";
		writer.boolean(`${path}.nowait`, value.nowait);
		writer.frameend();
		return writeSocket(socket, writer);
	},
	confirm_select_ok: (socket: Socket, channel: number)=>{ return writeVoid(5570571, socket, channel); }
};

export const METHODS = Object.freeze({
	connection_start: 655370,
	connection_start_ok: 655371,
	connection_secure: 655380,
	connection_secure_ok: 655381,
	connection_tune: 655390,
	connection_tune_ok: 655391,
	connection_open: 655400,
	connection_open_ok: 655401,
	connection_close: 655410,
	connection_close_ok: 655411,
	connection_blocked: 655420,
	connection_unblocked: 655421,
	connection_update_secret: 655430,
	connection_update_secret_ok: 655431,
	channel_open: 1310730,
	channel_open_ok: 1310731,
	channel_flow: 1310740,
	channel_flow_ok: 1310741,
	channel_close: 1310760,
	channel_close_ok: 1310761,
	exchange_declare: 2621450,
	exchange_declare_ok: 2621451,
	exchange_delete: 2621460,
	exchange_delete_ok: 2621461,
	exchange_bind: 2621470,
	exchange_bind_ok: 2621471,
	exchange_unbind: 2621480,
	exchange_unbind_ok: 2621491,
	queue_declare: 3276810,
	queue_declare_ok: 3276811,
	queue_bind: 3276820,
	queue_bind_ok: 3276821,
	queue_unbind: 3276850,
	queue_unbind_ok: 3276851,
	queue_purge: 3276830,
	queue_purge_ok: 3276831,
	queue_delete: 3276840,
	queue_delete_ok: 3276841,
	basic_properties: 60,
	basic_qos: 3932170,
	basic_qos_ok: 3932171,
	basic_consume: 3932180,
	basic_consume_ok: 3932181,
	basic_cancel: 3932190,
	basic_cancel_ok: 3932191,
	basic_publish: 3932200,
	basic_return: 3932210,
	basic_deliver: 3932220,
	basic_get: 3932230,
	basic_get_ok: 3932231,
	basic_get_empty: 3932232,
	basic_ack: 3932240,
	basic_reject: 3932250,
	basic_recover_async: 3932260,
	basic_recover: 3932270,
	basic_recover_ok: 3932271,
	basic_nack: 3932280,
	tx_select: 5898250,
	tx_select_ok: 5898251,
	tx_commit: 5898260,
	tx_commit_ok: 5898261,
	tx_rollback: 5898270,
	tx_rollback_ok: 5898271,
	confirm_select: 5570570,
	confirm_select_ok: 5570571
});

export const METHODS_NAMES = Object.freeze({
	655370: "connection_start",
	655371: "connection_start_ok",
	655380: "connection_secure",
	655381: "connection_secure_ok",
	655390: "connection_tune",
	655391: "connection_tune_ok",
	655400: "connection_open",
	655401: "connection_open_ok",
	655410: "connection_close",
	655411: "connection_close_ok",
	655420: "connection_blocked",
	655421: "connection_unblocked",
	655430: "connection_update_secret",
	655431: "connection_update_secret_ok",
	1310730: "channel_open",
	1310731: "channel_open_ok",
	1310740: "channel_flow",
	1310741: "channel_flow_ok",
	1310760: "channel_close",
	1310761: "channel_close_ok",
	2621450: "exchange_declare",
	2621451: "exchange_declare_ok",
	2621460: "exchange_delete",
	2621461: "exchange_delete_ok",
	2621470: "exchange_bind",
	2621471: "exchange_bind_ok",
	2621480: "exchange_unbind",
	2621491: "exchange_unbind_ok",
	3276810: "queue_declare",
	3276811: "queue_declare_ok",
	3276820: "queue_bind",
	3276821: "queue_bind_ok",
	3276850: "queue_unbind",
	3276851: "queue_unbind_ok",
	3276830: "queue_purge",
	3276831: "queue_purge_ok",
	3276840: "queue_delete",
	3276841: "queue_delete_ok",
	60: "basic_properties",
	3932170: "basic_qos",
	3932171: "basic_qos_ok",
	3932180: "basic_consume",
	3932181: "basic_consume_ok",
	3932190: "basic_cancel",
	3932191: "basic_cancel_ok",
	3932200: "basic_publish",
	3932210: "basic_return",
	3932220: "basic_deliver",
	3932230: "basic_get",
	3932231: "basic_get_ok",
	3932232: "basic_get_empty",
	3932240: "basic_ack",
	3932250: "basic_reject",
	3932260: "basic_recover_async",
	3932270: "basic_recover",
	3932271: "basic_recover_ok",
	3932280: "basic_nack",
	5898250: "tx_select",
	5898251: "tx_select_ok",
	5898260: "tx_commit",
	5898261: "tx_commit_ok",
	5898270: "tx_rollback",
	5898271: "tx_rollback_ok",
	5570570: "confirm_select",
	5570571: "confirm_select_ok"
});

