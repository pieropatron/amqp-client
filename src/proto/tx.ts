/**
 * @comment
 * ==  TX  ===============================================================
 * @doc
 * The Tx class allows publish and ack operations to be batched into atomic
 * units of work.  The intention is that all publish and ack requests issued
 * within a transaction will complete successfully or none of them will.
 * Servers SHOULD implement atomic transactions at least where all publish
 * or ack requests affect a single queue.  Transactions that cover multiple
 * queues may be non-atomic, given that queues can be created and destroyed
 * asynchronously, and such events do not form part of any transaction.
 * Further, the behaviour of transactions with respect to the immediate and
 * mandatory flags on Basic.Publish methods is not defined.
 * @grammar
 * tx                  = C:SELECT S:SELECT-OK
 * / C:COMMIT S:COMMIT-OK
 * / C:ROLLBACK S:ROLLBACK-OK
 * @label
 * work with transactions
 * @chassis
 * server: SHOULD, client: MAY
 * @rule
 * + @name not multiple queues
 * + @doc
 * + Applications MUST NOT rely on the atomicity of transactions that
 * + affect more than one queue.
 * @rule
 * + @name not immediate
 * + @doc
 * + Applications MUST NOT rely on the behaviour of transactions that
 * + include messages published with the immediate option.
 * @rule
 * + @name not mandatory
 * + @doc
 * + Applications MUST NOT rely on the behaviour of transactions that
 * + include messages published with the mandatory option.
 */

export const TX = {
	name: "tx",
	handler: "channel",
	index: 90,
	method: {
		/**
		 * @comment
		 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
		 * @doc
		 * This method sets the channel to use standard transactions. The client must use this
		 * method at least once on a channel before using the Commit or Rollback methods.
		 * @label
		 * select standard transaction mode
		 * @chassis
		 * server: MUST
		 */
		select: {
			synchronous: 1,
			index: 10,
			response: [
				{
					name: "select-ok"
				}
			]
		},
		/**
		 * @doc
		 * This method confirms to the client that the channel was successfully set to use
		 * standard transactions.
		 * @label
		 * confirm transaction mode
		 * @chassis
		 * client: MUST
		 */
		select_ok: {
			synchronous: 1,
			index: 11
		},
		/**
		 * @comment
		 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
		 * @doc
		 * This method commits all message publications and acknowledgments performed in
		 * the current transaction.  A new transaction starts immediately after a commit.
		 * @label
		 * commit the current transaction
		 * @chassis
		 * server: MUST
		 * @rule
		 * + @name transacted
		 * + @doc
		 * + The client MUST NOT use the Commit method on non-transacted channels.
		 * + @scenario
		 * + The client opens a channel and then uses Tx.Commit.
		 * + @on-failure
		 * + precondition-failed
		 */
		commit: {
			synchronous: 1,
			index: 20,
			response: [
				{
					name: "commit-ok"
				}
			]
		},
		/**
		 * @doc
		 * This method confirms to the client that the commit succeeded. Note that if a commit
		 * fails, the server raises a channel exception.
		 * @label
		 * confirm a successful commit
		 * @chassis
		 * client: MUST
		 */
		commit_ok: {
			synchronous: 1,
			index: 21
		},
		/**
		 * @comment
		 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
		 * @doc
		 * This method abandons all message publications and acknowledgments performed in
		 * the current transaction. A new transaction starts immediately after a rollback.
		 * Note that unacked messages will not be automatically redelivered by rollback;
		 * if that is required an explicit recover call should be issued.
		 * @label
		 * abandon the current transaction
		 * @chassis
		 * server: MUST
		 * @rule
		 * + @name transacted
		 * + @doc
		 * + The client MUST NOT use the Rollback method on non-transacted channels.
		 * + @scenario
		 * + The client opens a channel and then uses Tx.Rollback.
		 * + @on-failure
		 * + precondition-failed
		 */
		rollback: {
			synchronous: 1,
			index: 30,
			response: [
				{
					name: "rollback-ok"
				}
			]
		},
		/**
		 * @doc
		 * This method confirms to the client that the rollback succeeded. Note that if an
		 * rollback fails, the server raises a channel exception.
		 * @label
		 * confirm successful rollback
		 * @chassis
		 * client: MUST
		 */
		rollback_ok: {
			synchronous: 1,
			index: 31
		}
	}
};

