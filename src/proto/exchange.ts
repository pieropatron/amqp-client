/**
 * @comment
 * ==  EXCHANGE  =========================================================
 * @doc
 * Exchanges match and distribute messages across queues. Exchanges can be configured in
 * the server or declared at runtime.
 * @grammar
 * exchange            = C:DECLARE  S:DECLARE-OK
 * / C:DELETE   S:DELETE-OK
 * / C:BIND     S:BIND-OK
 * / C:UNBIND   S:UNBIND-OK
 * @label
 * work with exchanges
 * @chassis
 * server: MUST, client: MUST
 * @rule
 * + @name required-types
 * + @doc
 * + The server MUST implement these standard exchange types: fanout, direct.
 * + @scenario
 * + Client attempts to declare an exchange with each of these standard types.
 * @rule
 * + @name recommended-types
 * + @doc
 * + The server SHOULD implement these standard exchange types: topic, headers.
 * + @scenario
 * + Client attempts to declare an exchange with each of these standard types.
 * @rule
 * + @name required-instances
 * + @doc
 * + The server MUST, in each virtual host, pre-declare an exchange instance
 * + for each standard exchange type that it implements, where the name of the
 * + exchange instance, if defined, is "amq." followed by the exchange type name.
 * + @doc
 * + The server MUST, in each virtual host, pre-declare at least two direct
 * + exchange instances: one named "amq.direct", the other with no public name
 * + that serves as a default  exchange for Publish methods.
 * + @scenario
 * + Client declares a temporary queue and attempts to bind to each required
 * + exchange instance ("amq.fanout", "amq.direct", "amq.topic", and "amq.headers"
 * + if those types are defined).
 * @rule
 * + @name default-exchange
 * + @doc
 * + The server MUST pre-declare a direct exchange with no public name to act as
 * + the default exchange for content Publish methods and for default queue bindings.
 * + @scenario
 * + Client checks that the default exchange is active by specifying a queue
 * + binding with no exchange name, and publishing a message with a suitable
 * + routing key but without specifying the exchange name, then ensuring that
 * + the message arrives in the queue correctly.
 * @rule
 * + @name default-access
 * + @doc
 * + The server MUST NOT allow clients to access the default exchange except
 * + by specifying an empty exchange name in the Queue.Bind and content Publish
 * + methods.
 * @rule
 * + @name extensions
 * + @doc
 * + The server MAY implement other exchange types as wanted.
 */

export const EXCHANGE = {
	name: "exchange",
	handler: "channel",
	index: 40,
	method: {
		/**
		 * @comment
		 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
		 * @doc
		 * This method creates an exchange if it does not already exist, and if the exchange
		 * exists, verifies that it is of the correct and expected class.
		 * @label
		 * verify exchange exists, create if needed
		 * @chassis
		 * server: MUST
		 * @rule
		 * + @name minimum
		 * + @doc
		 * + The server SHOULD support a minimum of 16 exchanges per virtual host and
		 * + ideally, impose no limit except as defined by available resources.
		 * + @scenario
		 * + The client declares as many exchanges as it can until the server reports
		 * + an error; the number of exchanges successfully declared must be at least
		 * + sixteen.
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
				exchange: {
					domain: "exchange-name",
					assert: [
						{
							check: "notnull"
						}
					]
				},
				type: {
					domain: "shortstr"
				},
				passive: {
					domain: "bit"
				},
				durable: {
					domain: "bit"
				},
				auto_delete: {
					domain: "bit"
				},
				internal: {
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
		 * This method confirms a Declare method and confirms the name of the exchange,
		 * essential for automatically-named exchanges.
		 * @label
		 * confirm exchange declaration
		 * @chassis
		 * client: MUST
		 */
		declare_ok: {
			synchronous: 1,
			index: 11
		},
		/**
		 * @comment
		 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
		 * @doc
		 * This method deletes an exchange. When an exchange is deleted all queue bindings on
		 * the exchange are cancelled.
		 * @label
		 * delete an exchange
		 * @chassis
		 * server: MUST
		 */
		delete: {
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
				exchange: {
					domain: "exchange-name",
					assert: [
						{
							check: "notnull"
						}
					]
				},
				if_unused: {
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
		 * This method confirms the deletion of an exchange.
		 * @label
		 * confirm deletion of an exchange
		 * @chassis
		 * client: MUST
		 */
		delete_ok: {
			synchronous: 1,
			index: 21
		},
		/**
		 * @comment
		 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
		 * @doc
		 * This method binds an exchange to an exchange.
		 * @label
		 * bind exchange to an exchange
		 * @chassis
		 * server: MUST
		 * @rule
		 * + @name duplicates
		 * + @doc
		 * + A server MUST allow and ignore duplicate bindings - that is,
		 * + two or more bind methods for a specific exchanges, with
		 * + identical arguments - without treating these as an error.
		 * + @scenario
		 * + A client binds an exchange to an exchange. The client then
		 * + repeats the bind (with identical arguments).
		 * @rule
		 * + @name cyclical
		 * + @doc
		 * + A server MUST allow cycles of exchange bindings to be
		 * + created including allowing an exchange to be bound to
		 * + itself.
		 * + @scenario
		 * + A client declares an exchange and binds it to itself.
		 * @rule
		 * + @name unique
		 * + @doc
		 * + A server MUST not deliver the same message more than once to
		 * + a destination exchange, even if the topology of exchanges
		 * + and bindings results in multiple (even infinite) routes to
		 * + that exchange.
		 * + @scenario
		 * + A client declares an exchange and binds it using multiple
		 * + bindings to the amq.topic exchange. The client then
		 * + publishes a message to the amq.topic exchange that matches
		 * + all the bindings.
		 */
		bind: {
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
				destination: {
					domain: "exchange-name"
				},
				source: {
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
			index: 31
		},
		/**
		 * @comment
		 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
		 * @doc
		 * This method unbinds an exchange from an exchange.
		 * @label
		 * unbind an exchange from an exchange
		 * @chassis
		 * server: MUST
		 * @rule
		 * + @name 1
		 * + @doc
		 * + If a unbind fails, the server MUST raise a connection exception.
		 */
		unbind: {
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
				destination: {
					domain: "exchange-name"
				},
				source: {
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
		}
	}
};

