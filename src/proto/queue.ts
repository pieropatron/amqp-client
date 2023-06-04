/**
 * @comment
 * ==  QUEUE  ============================================================
 * @doc
 * Queues store and forward messages. Queues can be configured in the server or created at
 * runtime. Queues must be attached to at least one exchange in order to receive messages
 * from publishers.
 * @grammar
 * queue               = C:DECLARE  S:DECLARE-OK
 * / C:BIND     S:BIND-OK
 * / C:UNBIND   S:UNBIND-OK
 * / C:PURGE    S:PURGE-OK
 * / C:DELETE   S:DELETE-OK
 * @label
 * work with queues
 * @chassis
 * server: MUST, client: MUST
 */

export const QUEUE = {
	name: "queue",
	handler: "channel",
	index: 50,
	method: {
		/**
		 * @comment
		 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
		 * @doc
		 * This method creates or checks a queue. When creating a new queue the client can
		 * specify various properties that control the durability of the queue and its
		 * contents, and the level of sharing for the queue.
		 * @label
		 * declare queue, create if needed
		 * @chassis
		 * server: MUST
		 * @rule
		 * + @name default-binding
		 * + @doc
		 * + The server MUST create a default binding for a newly-declared queue to the
		 * + default exchange, which is an exchange of type 'direct' and use the queue
		 * + name as the routing key.
		 * + @scenario
		 * + Client declares a new queue, and then without explicitly binding it to an
		 * + exchange, attempts to send a message through the default exchange binding,
		 * + i.e. publish a message to the empty exchange, with the queue name as routing
		 * + key.
		 * @rule
		 * + @name minimum-queues
		 * + @doc
		 * + The server SHOULD support a minimum of 256 queues per virtual host and ideally,
		 * + impose no limit except as defined by available resources.
		 * + @scenario
		 * + Client attempts to declare as many queues as it can until the server reports
		 * + an error.  The resulting count must at least be 256.
		 */
		declare: {
			synchronous: 1,
			index: 10,
			field: {
				/**
				 * @comment
				 * Deprecated: "ticket", must be zero
				 */
				reserved_1: {
					type: "short",
					reserved: 1
				},
				queue: {
					domain: "queue-name"
				},
				passive: {
					domain: "bit"
				},
				durable: {
					domain: "bit"
				},
				exclusive: {
					domain: "bit"
				},
				auto_delete: {
					domain: "bit"
				},
				no_wait: {
					domain: "no-wait"
				},
				arguments: {
					domain: "table"
				}
			},
			response: [
				{
					name: "declare-ok"
				}
			]
		},
		/**
		 * @doc
		 * This method confirms a Declare method and confirms the name of the queue, essential
		 * for automatically-named queues.
		 * @label
		 * confirms a queue definition
		 * @chassis
		 * client: MUST
		 */
		declare_ok: {
			synchronous: 1,
			index: 11,
			field: {
				queue: {
					domain: "queue-name",
					assert: [
						{
							check: "notnull"
						}
					]
				},
				message_count: {
					domain: "message-count"
				},
				consumer_count: {
					domain: "long"
				}
			}
		},
		/**
		 * @comment
		 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
		 * @doc
		 * This method binds a queue to an exchange. Until a queue is bound it will not
		 * receive any messages. In a classic messaging model, store-and-forward queues
		 * are bound to a direct exchange and subscription queues are bound to a topic
		 * exchange.
		 * @label
		 * bind queue to an exchange
		 * @chassis
		 * server: MUST
		 * @rule
		 * + @name duplicates
		 * + @doc
		 * + A server MUST allow ignore duplicate bindings - that is, two or more bind
		 * + methods for a specific queue, with identical arguments - without treating these
		 * + as an error.
		 * + @scenario
		 * + A client binds a named queue to an exchange. The client then repeats the bind
		 * + (with identical arguments).
		 * @rule
		 * + @name unique
		 * + @doc
		 * + A server MUST not deliver the same message more than once to a queue, even if
		 * + the queue has multiple bindings that match the message.
		 * + @scenario
		 * + A client declares a named queue and binds it using multiple bindings to the
		 * + amq.topic exchange. The client then publishes a message that matches all its
		 * + bindings.
		 * @rule
		 * + @name transient-exchange
		 * + @doc
		 * + The server MUST allow a durable queue to bind to a transient exchange.
		 * + @scenario
		 * + A client declares a transient exchange. The client then declares a named durable
		 * + queue and then attempts to bind the transient exchange to the durable queue.
		 * @rule
		 * + @name durable-exchange
		 * + @doc
		 * + Bindings of durable queues to durable exchanges are automatically durable
		 * + and the server MUST restore such bindings after a server restart.
		 * + @scenario
		 * + A server declares a named durable queue and binds it to a durable exchange. The
		 * + server is restarted. The client then attempts to use the queue/exchange combination.
		 * @rule
		 * + @name binding-count
		 * + @doc
		 * + The server SHOULD support at least 4 bindings per queue, and ideally, impose no
		 * + limit except as defined by available resources.
		 * + @scenario
		 * + A client declares a named queue and attempts to bind it to 4 different
		 * + exchanges.
		 */
		bind: {
			synchronous: 1,
			index: 20,
			field: {
				/**
				 * @comment
				 * Deprecated: "ticket", must be zero
				 */
				reserved_1: {
					type: "short",
					reserved: 1
				},
				queue: {
					domain: "queue-name"
				},
				exchange: {
					domain: "exchange-name"
				},
				routing_key: {
					domain: "shortstr"
				},
				no_wait: {
					domain: "no-wait"
				},
				arguments: {
					domain: "table"
				}
			},
			response: [
				{
					name: "bind-ok"
				}
			]
		},
		/**
		 * @doc
		 * This method confirms that the bind was successful.
		 * @label
		 * confirm bind successful
		 * @chassis
		 * client: MUST
		 */
		bind_ok: {
			synchronous: 1,
			index: 21
		},
		/**
		 * @comment
		 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
		 * @doc
		 * This method unbinds a queue from an exchange.
		 * @label
		 * unbind a queue from an exchange
		 * @chassis
		 * server: MUST
		 * @rule
		 * + @name 1
		 * + @doc
		 * + If a unbind fails, the server MUST raise a connection exception.
		 */
		unbind: {
			synchronous: 1,
			index: 50,
			field: {
				/**
				 * @comment
				 * Deprecated: "ticket", must be zero
				 */
				reserved_1: {
					type: "short",
					reserved: 1
				},
				queue: {
					domain: "queue-name"
				},
				exchange: {
					domain: "exchange-name"
				},
				routing_key: {
					domain: "shortstr"
				},
				arguments: {
					domain: "table"
				}
			},
			response: [
				{
					name: "unbind-ok"
				}
			]
		},
		/**
		 * @doc
		 * This method confirms that the unbind was successful.
		 * @label
		 * confirm unbind successful
		 * @chassis
		 * client: MUST
		 */
		unbind_ok: {
			synchronous: 1,
			index: 51
		},
		/**
		 * @comment
		 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
		 * @doc
		 * This method removes all messages from a queue which are not awaiting
		 * acknowledgment.
		 * @label
		 * purge a queue
		 * @chassis
		 * server: MUST
		 * @rule
		 * + @name 2
		 * + @doc
		 * + The server MUST NOT purge messages that have already been sent to a client
		 * + but not yet acknowledged.
		 * @rule
		 * + @name 3
		 * + @doc
		 * + The server MAY implement a purge queue or log that allows system administrators
		 * + to recover accidentally-purged messages. The server SHOULD NOT keep purged
		 * + messages in the same storage spaces as the live messages since the volumes of
		 * + purged messages may get very large.
		 */
		purge: {
			synchronous: 1,
			index: 30,
			field: {
				/**
				 * @comment
				 * Deprecated: "ticket", must be zero
				 */
				reserved_1: {
					type: "short",
					reserved: 1
				},
				queue: {
					domain: "queue-name"
				},
				no_wait: {
					domain: "no-wait"
				}
			},
			response: [
				{
					name: "purge-ok"
				}
			]
		},
		/**
		 * @doc
		 * This method confirms the purge of a queue.
		 * @label
		 * confirms a queue purge
		 * @chassis
		 * client: MUST
		 */
		purge_ok: {
			synchronous: 1,
			index: 31,
			field: {
				message_count: {
					domain: "message-count"
				}
			}
		},
		/**
		 * @comment
		 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
		 * @doc
		 * This method deletes a queue. When a queue is deleted any pending messages are sent
		 * to a dead-letter queue if this is defined in the server configuration, and all
		 * consumers on the queue are cancelled.
		 * @label
		 * delete a queue
		 * @chassis
		 * server: MUST
		 * @rule
		 * + @name 1
		 * + @doc
		 * + The server SHOULD use a dead-letter queue to hold messages that were pending on
		 * + a deleted queue, and MAY provide facilities for a system administrator to move
		 * + these messages back to an active queue.
		 */
		delete: {
			synchronous: 1,
			index: 40,
			field: {
				/**
				 * @comment
				 * Deprecated: "ticket", must be zero
				 */
				reserved_1: {
					type: "short",
					reserved: 1
				},
				queue: {
					domain: "queue-name"
				},
				if_unused: {
					domain: "bit"
				},
				if_empty: {
					domain: "bit"
				},
				no_wait: {
					domain: "no-wait"
				}
			},
			response: [
				{
					name: "delete-ok"
				}
			]
		},
		/**
		 * @doc
		 * This method confirms the deletion of a queue.
		 * @label
		 * confirm deletion of a queue
		 * @chassis
		 * client: MUST
		 */
		delete_ok: {
			synchronous: 1,
			index: 41,
			field: {
				message_count: {
					domain: "message-count"
				}
			}
		}
	}
};

