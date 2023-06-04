import { BufferReader, BufferWriter, ENCODING } from 'proto/codec';

/**
 * Interface for describe SASL mechanism
 */
export interface IMechanism {
	/** Name of mechanism */
	name: string,
	/**
	 * Encode info
	 * @param user for encode
	 * @param password for encode
	 */
	encode(user: string, password: string): string,
	/**
	 * Decode info
	 * @param value for decode
	 */
	decode(value: string): { user: string, password: string },
}

const char0 = String.fromCharCode(0);

/**
 * PLAIN mechanism
 */
const PLAIN: IMechanism = {
	name: "PLAIN",
	encode(user, password) {
		return ["", user, password].join(char0);
	},
	decode(value) {
		const [, user, password] = value.split(char0);
		return { user, password };
	}
};

/**
 * AMQPLAIN mechanism
 */
const AMQPLAIN: IMechanism = {
	name: "AMQPLAIN",
	encode(user, password) {
		const writer = new BufferWriter(23 + Buffer.byteLength(user, ENCODING) + Buffer.byteLength(password, ENCODING), true);
		writer.tableitems("$", { LOGIN: user, PASSWORD: password });
		return writer.buffer.toString(ENCODING, 0, writer.offset);
	},
	decode(value) {
		const reader = new BufferReader(Buffer.from(value, ENCODING));
		const { LOGIN: user, PASSWORD: password } = reader.tableitems("$");
		return { user, password };
	}
};

export const SASL_MECHANISM = {
	PLAIN,
	AMQPLAIN
};
