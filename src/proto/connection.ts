/**
 * @comment
 * ==  CONNECTION  =======================================================
 * @doc
 * The connection class provides methods for a client to establish a network connection to
 * a server, and for both peers to operate the connection thereafter.
 * @grammar
 * connection          = open-connection *use-connection close-connection
 * open-connection     = C:protocol-header
 * S:START C:START-OK
 * *challenge
 * S:TUNE C:TUNE-OK
 * C:OPEN S:OPEN-OK
 * challenge           = S:SECURE C:SECURE-OK
 * use-connection      = *channel
 * close-connection    = C:CLOSE S:CLOSE-OK
 * / S:CLOSE C:CLOSE-OK
 * @label
 * work with socket connections
 * @chassis
 * server: MUST, client: MUST
 */

export const CONNECTION = {
	name: "connection",
	handler: "connection",
	index: 10,
	method: {
		/**
		 * @comment
		 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
		 * @doc
		 * This method starts the connection negotiation process by telling the client the
		 * protocol version that the server proposes, along with a list of security mechanisms
		 * which the client can use for authentication.
		 * @label
		 * start connection negotiation
		 * @chassis
		 * client: MUST
		 * @rule
		 * + @name protocol-name
		 * + @doc
		 * + If the server cannot support the protocol specified in the protocol header,
		 * + it MUST respond with a valid protocol header and then close the socket
		 * + connection.
		 * + @scenario
		 * + The client sends a protocol header containing an invalid protocol name.
		 * + The server MUST respond by sending a valid protocol header and then closing
		 * + the connection.
		 * @rule
		 * + @name server-support
		 * + @doc
		 * + The server MUST provide a protocol version that is lower than or equal to
		 * + that requested by the client in the protocol header.
		 * + @scenario
		 * + The client requests a protocol version that is higher than any valid
		 * + implementation, e.g. 2.0.  The server must respond with a protocol header
		 * + indicating its supported protocol version, e.g. 1.0.
		 * @rule
		 * + @name client-support
		 * + @doc
		 * + If the client cannot handle the protocol version suggested by the server
		 * + it MUST close the socket connection without sending any further data.
		 * + @scenario
		 * + The server sends a protocol version that is lower than any valid
		 * + implementation, e.g. 0.1.  The client must respond by closing the
		 * + connection without sending any further data.
		 */
		start: {
			synchronous: 1,
			index: 10,
			field: {
				version_major: {
					domain: "octet"
				},
				version_minor: {
					domain: "octet"
				},
				server_properties: {
					domain: "peer-properties"
				},
				mechanisms: {
					domain: "longstr",
					assert: [
						{
							check: "notnull"
						}
					]
				},
				locales: {
					domain: "longstr",
					assert: [
						{
							check: "notnull"
						}
					]
				}
			},
			response: [
				{
					name: "start-ok"
				}
			]
		},
		/**
		 * @doc
		 * This method selects a SASL security mechanism.
		 * @label
		 * select security mechanism and locale
		 * @chassis
		 * server: MUST
		 */
		start_ok: {
			synchronous: 1,
			index: 11,
			field: {
				client_properties: {
					domain: "peer-properties"
				},
				mechanism: {
					domain: "shortstr",
					assert: [
						{
							check: "notnull"
						}
					]
				},
				response: {
					domain: "longstr",
					assert: [
						{
							check: "notnull"
						}
					]
				},
				locale: {
					domain: "shortstr",
					assert: [
						{
							check: "notnull"
						}
					]
				}
			}
		},
		/**
		 * @comment
		 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
		 * @doc
		 * The SASL protocol works by exchanging challenges and responses until both peers have
		 * received sufficient information to authenticate each other. This method challenges
		 * the client to provide more information.
		 * @label
		 * security mechanism challenge
		 * @chassis
		 * client: MUST
		 */
		secure: {
			synchronous: 1,
			index: 20,
			field: {
				challenge: {
					domain: "longstr"
				}
			},
			response: [
				{
					name: "secure-ok"
				}
			]
		},
		/**
		 * @doc
		 * This method attempts to authenticate, passing a block of SASL data for the security
		 * mechanism at the server side.
		 * @label
		 * security mechanism response
		 * @chassis
		 * server: MUST
		 */
		secure_ok: {
			synchronous: 1,
			index: 21,
			field: {
				response: {
					domain: "longstr",
					assert: [
						{
							check: "notnull"
						}
					]
				}
			}
		},
		/**
		 * @comment
		 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
		 * @doc
		 * This method proposes a set of connection configuration values to the client. The
		 * client can accept and/or adjust these.
		 * @label
		 * propose connection tuning parameters
		 * @chassis
		 * client: MUST
		 */
		tune: {
			synchronous: 1,
			index: 30,
			field: {
				channel_max: {
					domain: "short"
				},
				frame_max: {
					domain: "long"
				},
				heartbeat: {
					domain: "short"
				}
			},
			response: [
				{
					name: "tune-ok"
				}
			]
		},
		/**
		 * @doc
		 * This method sends the client's connection tuning parameters to the server.
		 * Certain fields are negotiated, others provide capability information.
		 * @label
		 * negotiate connection tuning parameters
		 * @chassis
		 * server: MUST
		 */
		tune_ok: {
			synchronous: 1,
			index: 31,
			field: {
				channel_max: {
					domain: "short",
					assert: [
						{
							check: "notnull"
						},
						{
							check: "le",
							method: "tune",
							field: "channel-max"
						}
					]
				},
				frame_max: {
					domain: "long"
				},
				heartbeat: {
					domain: "short"
				}
			}
		},
		/**
		 * @comment
		 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
		 * @doc
		 * This method opens a connection to a virtual host, which is a collection of
		 * resources, and acts to separate multiple application domains within a server.
		 * The server may apply arbitrary limits per virtual host, such as the number
		 * of each type of entity that may be used, per connection and/or in total.
		 * @label
		 * open connection to virtual host
		 * @chassis
		 * server: MUST
		 */
		open: {
			synchronous: 1,
			index: 40,
			field: {
				virtual_host: {
					domain: "path"
				},
				/**
				 * @comment
				 * Deprecated: "capabilities", must be zero
				 */
				reserved_1: {
					type: "shortstr",
					reserved: 1
				},
				/**
				 * @comment
				 * Deprecated: "insist", must be zero
				 */
				reserved_2: {
					type: "bit",
					reserved: 1
				}
			},
			response: [
				{
					name: "open-ok"
				}
			]
		},
		/**
		 * @doc
		 * This method signals to the client that the connection is ready for use.
		 * @label
		 * signal that connection is ready
		 * @chassis
		 * client: MUST
		 */
		open_ok: {
			synchronous: 1,
			index: 41,
			field: {
				/**
				 * @comment
				 * Deprecated: "known-hosts", must be zero
				 */
				reserved_1: {
					type: "shortstr",
					reserved: 1
				}
			}
		},
		/**
		 * @comment
		 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
		 * @doc
		 * This method indicates that the sender wants to close the connection. This may be
		 * due to internal conditions (e.g. a forced shut-down) or due to an error handling
		 * a specific method, i.e. an exception. When a close is due to an exception, the
		 * sender provides the class and method id of the method which caused the exception.
		 * @label
		 * request a connection close
		 * @chassis
		 * client: MUST, server: MUST
		 * @rule
		 * + @name stability
		 * + @doc
		 * + After sending this method, any received methods except Close and Close-OK MUST
		 * + be discarded.  The response to receiving a Close after sending Close must be to
		 * + send Close-Ok.
		 */
		close: {
			synchronous: 1,
			index: 50,
			field: {
				reply_code: {
					domain: "reply-code"
				},
				reply_text: {
					domain: "reply-text"
				},
				/**
				 * @doc
				 * When the close is provoked by a method exception, this is the class of the
				 * method.
				 * @label
				 * failing method class
				 */
				class_id: {
					domain: "class-id"
				},
				method_id: {
					domain: "method-id"
				}
			},
			response: [
				{
					name: "close-ok"
				}
			]
		},
		/**
		 * @doc
		 * This method confirms a Connection.Close method and tells the recipient that it is
		 * safe to release resources for the connection and close the socket.
		 * @label
		 * confirm a connection close
		 * @chassis
		 * client: MUST, server: MUST
		 * @rule
		 * + @name reporting
		 * + @doc
		 * + A peer that detects a socket closure without having received a Close-Ok
		 * + handshake method SHOULD log the error.
		 */
		close_ok: {
			synchronous: 1,
			index: 51
		},
		/**
		 * @doc
		 * This method indicates that a connection has been blocked
		 * and does not accept new publishes.
		 * @label
		 * indicate that connection is blocked
		 * @chassis
		 * server: MUST, client: MUST
		 */
		blocked: {
			index: 60,
			field: {
				reason: {
					domain: "shortstr",
					required: 0
				}
			}
		},
		/**
		 * @doc
		 * This method indicates that a connection has been unblocked
		 * and now accepts publishes.
		 * @label
		 * indicate that connection is unblocked
		 * @chassis
		 * server: MUST, client: MUST
		 */
		unblocked: {
			index: 61
		},
		/**
		 * @doc
		 * This method updates the secret used to authenticate this connection. It is used
		 * when secrets have an expiration date and need to be renewed, like OAuth 2 tokens.
		 * @label
		 * update secret
		 * @chassis
		 * client: MUST
		 */
		update_secret: {
			synchronous: 1,
			index: 70,
			field: {
				new_secret: {
					domain: "longstr"
				},
				reason: {
					domain: "shortstr"
				}
			},
			response: [
				{
					name: "update-secret-ok"
				}
			]
		},
		/**
		 * @doc
		 * This method confirms the updated secret is valid.
		 * @label
		 * update secret response
		 * @chassis
		 * server: MUST
		 */
		update_secret_ok: {
			synchronous: 1,
			index: 71
		}
	}
};

