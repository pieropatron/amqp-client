import { Socket } from "net";
import { FRAME_TYPES, FRAME_CONST } from './constant';

export const ENCODING = 'utf8';
export const EMPTY_FRAME_SIZE = 8;
export const EMPTY_FRAME_METHOD_PAYLOAD_SIZE = 4;
export const EMPTY_FRAME_METHOD_SIZE = EMPTY_FRAME_SIZE + EMPTY_FRAME_METHOD_PAYLOAD_SIZE;

const MAX_UINT32 = 4294967296;
const MAX_SECOND = 8640000000000;
const SECOND = 1000;
const INVALID_DATE = "Invalid Date";

const RE_FieldName = /^[A-z$#][A-z0-9$#_.]{0,127}$/;

const CHAR_METHODS = new Map<number, string>([
	["t".charCodeAt(0), "boolean"],
	["b".charCodeAt(0), "int8"],
	["B".charCodeAt(0), "uint8"],
	["s".charCodeAt(0), "int16"],
	["u".charCodeAt(0), "uint16"],
	["I".charCodeAt(0), "int32"],
	["i".charCodeAt(0), "uint32"],
	["L".charCodeAt(0), "int64"],
	["l".charCodeAt(0), "int64"],
	["f".charCodeAt(0), "float"],
	["d".charCodeAt(0), "double"],
	["D".charCodeAt(0), "decimal"],
	["S".charCodeAt(0), "longstr"],
	["T".charCodeAt(0), "timestamp"],
	["V".charCodeAt(0), "void"],
	["x".charCodeAt(0), "binary"],
	["F".charCodeAt(0), "table"],
	["A".charCodeAt(0), "array"]
]);

const BITS8: number[] = [];
for (let i = 0; i < 8; i++) BITS8.push(1 << i);

const BITS_BASIC: number[] = [];
for (let i = 16; i > 0; i--) BITS_BASIC.push(1 << (i-1));

export class BufferReader {
	private readonly _buffer: Buffer;
	private _offset = 0;
	public current_path: string;
	constructor(buffer: Buffer){
		this._buffer = buffer;
	}

	get buffer(){ return this._buffer; }

	get offset(){ return this._offset; }

	uint8(path: string){
		this.current_path = path;
		const result = this._buffer.readUInt8(this._offset);
		this._offset++;
		return result;
	}

	int8(path: string){
		this.current_path = path;
		const result = this._buffer.readInt8(this._offset);
		this._offset++;
		return result;
	}

	uint16(path: string){
		this.current_path = path;
		const result = this._buffer.readUInt16BE(this._offset);
		this._offset+=2;
		return result;
	}

	int16(path: string){
		this.current_path = path;
		const result = this._buffer.readInt16BE(this._offset);
		this._offset+=2;
		return result;
	}

	uint32(path: string){
		this.current_path = path;
		const result = this._buffer.readUInt32BE(this._offset);
		this._offset+=4;
		return result;
	}

	int32(path: string){
		this.current_path = path;
		const result = this._buffer.readInt32BE(this._offset);
		this._offset+=4;
		return result;
	}

	uint64(path: string){
		this.current_path = path;
		const result = this._buffer.readBigUInt64BE(this._offset);
		this._offset+=8;
		return result;
	}

	int64(path: string){
		this.current_path = path;
		const result = this._buffer.readBigInt64BE(this._offset);
		this._offset+=8;
		return result;
	}

	shortstr(path: string) {
		const length = this.uint8(path + '.length');
		this.current_path = path;
		const offset = this._offset + length;
		const result = this._buffer.toString(ENCODING, this._offset, offset);
		this._offset = offset;
		return result;
	}

	longstr(path: string) {
		const length = this.uint32(path + '.length');
		this.current_path = path;
		const offset = this._offset + length;
		const result = this._buffer.toString(ENCODING, this._offset, offset);
		this._offset = offset;
		return result;
	}

	timestamp(path: string){
		const bytes = this.uint64(path);
		if (bytes > MAX_SECOND) {
			throw new RangeError(`Date out of range for ${path}`);
		}

		const milliseconds = Number((bytes as any) * SECOND) as number;
		return new Date(milliseconds);
	}

	boolean(path: string){
		const bytes = this.uint8(path);
		return bytes > 0;
	}

	float(path: string) {
		this.current_path = path;
		const result = this._buffer.readFloatBE(this._offset);
		this._offset += 4;
		return result;
	}

	double(path: string) {
		this.current_path = path;
		const result = this._buffer.readDoubleBE(this._offset);
		this._offset += 8;
		return result;
	}

	decimal(path: string){
		const fraction_size = this.uint8(path + ".fraction_size");
		const long_value = this.uint32(path + ".long_value");
		return long_value / (10 ** fraction_size);
	}

	void(){}

	binary(path: string){
		const length = this.uint32(path + ".length");
		this.current_path = path;
		if (length) {
			const start = this._offset;
			const end = this._offset = start + length;
			return this._buffer.subarray(start, end);
		} else {
			return Buffer.allocUnsafe(0);
		}
	}

	private tableitem(path: string){
		const char = this.uint8(path + ".char");
		const method = CHAR_METHODS.get(char);
		if (method === undefined) {
			throw new RangeError(`Unknown table item char [${String.fromCharCode(char)}] for ${path}`);
		}
		return this[method](path);
	}

	tableitems(path: string, end?: number){
		this.current_path = path;
		end = end || this._buffer.length;
		const result: any = {};
		while (this._offset < end) {
			const key = this.shortstr(path + ".key");
			if (!RE_FieldName.test(key)) {
				throw new RangeError(`Invalid field table key [${key}]`);
			}
			result[key] = this.tableitem(path + "." + key);
		}

		if (this._offset !== end) {
			throw new SyntaxError(`Unexpected table end for ${path}`);
		}
		return result;
	}

	table(path: string){
		const length = this.uint32(path + ".length");
		if (!length) return {};
		if (this._offset + length > this._buffer.length){
			throw new SyntaxError(`Table out of buffer end`);
		}
		return this.tableitems(path, this._offset + length);
	}

	array(path: string){
		this.current_path = path;
		const value: any[] = [];
		const length = this.uint32(path + ".length");
		if (!length) return value;

		const end = this._offset + length;

		let i=0;
		while (this._offset < end) {
			const item = this.tableitem(`path[${i}]`);
			value.push(item);
			i++;
		}
		if (this._offset !== end) {
			throw new SyntaxError(`Unexpected array end for ${path}`);
		}
		return value;
	}

	bits8(path: string, keys: string[], destination: object){
		const flag = this.uint8(path + '.flag');
		for (let i=0; i < keys.length; i++){
			destination[keys[i]] = flag & BITS8[i];
		}
	}

	properties(path: string, items: {key: string, method: string}[], destination: object){
		const flag = this.uint16(path + ".flag");
		for (let i=0; i < items.length; i++){
			if (!(flag & BITS_BASIC[i])){
				continue;
			}
			const item = items[i];
			destination[item.key] = this[item.method](`${path}.${item.key}`);
		}
	}

	skip(size = 1){
		this._offset += size;
	}

	body(size: number){
		const end = this._offset + size;
		const value = this._buffer.subarray(this._offset, end);
		this._offset = end;
		return value;
	}
}

const BUFFER_INC = 1024;

export class BufferWriter {
	private _buffer: Buffer;
	private _offset = 0;
	public current_path: string;
	private safewrite: (size: number, callback: () => void)=>void;
	public readonly dynamic: boolean;
	constructor(initial_size: number, dynamic: boolean) {
		this._buffer = Buffer.allocUnsafe(initial_size);
		this.safewrite = dynamic ? this.safewritedynamic : this.safewritestatic;
		this.dynamic = dynamic;
	}

	get offset(){ return this._offset; }

	get buffer(){ return this._buffer; }

	private safewritestatic(size: number, callback: ()=>void){
		const offset = this._offset + size;
		callback();
		this._offset = offset;
	}

	private safewritedynamic(size: number, callback: ()=>void){
		const offset = this._offset + size;
		if (offset > this._buffer.length){
			this._buffer = Buffer.concat([this._buffer, Buffer.allocUnsafe(size + BUFFER_INC)]);
		}
		callback();
		this._offset = offset;
	}

	uint8(path: string, value: number) {
		this.current_path = path;
		this.safewrite(1, ()=>{
			this._buffer.writeUInt8(value, this._offset);
		});
	}

	int8(path: string, value: number) {
		this.current_path = path;
		this.safewrite(1, () => {
			this._buffer.writeInt8(value, this._offset);
		});
	}

	uint16(path: string, value: number) {
		this.current_path = path;
		this.safewrite(2, () => {
			this._buffer.writeUInt16BE(value, this._offset);
		});
	}

	int16(path: string, value: number) {
		this.current_path = path;
		this.safewrite(2, () => {
			this._buffer.writeInt16BE(value, this._offset);
		});
	}

	uint32(path: string, value: number) {
		this.current_path = path;
		this.safewrite(4, () => {
			this._buffer.writeUInt32BE(value, this._offset);
		});
	}

	int32(path: string, value: number) {
		this.current_path = path;
		this.safewrite(4, () => {
			this._buffer.writeInt32BE(value, this._offset);
		});
	}

	uint64(path: string, value: bigint) {
		this.current_path = path;
		this.safewrite(8, () => {
			this._buffer.writeBigUInt64BE(value, this._offset);
		});
	}

	int64(path: string, value: bigint) {
		this.current_path = path;
		this.safewrite(8, () => {
			this._buffer.writeBigInt64BE(value, this._offset);
		});
	}

	shortstr(path: string, value: string) {
		const length = Buffer.byteLength(value, ENCODING);
		this.safewrite(length + 1, ()=>{
			this.current_path = path + ".length";
			this._buffer.writeUInt8(length, this._offset);
			this.current_path = path;
			this._buffer.write(value, this._offset + 1, ENCODING);
		});
	}

	longstr(path: string, value: string) {
		const length = Buffer.byteLength(value, ENCODING);
		this.safewrite(length + 4, () => {
			this.current_path = path + ".length";
			this._buffer.writeUInt32BE(length, this._offset);
			this.current_path = path;
			this._buffer.write(value, this._offset + 4, ENCODING);
		});
	}

	timestamp(path: string, value: Date) {
		if (value.toString() === INVALID_DATE) {
			throw new TypeError(`${INVALID_DATE} for ${path}`);
		}
		this.uint64(path, BigInt(Math.floor(value.valueOf() / SECOND) as any));
	}

	boolean(path: string, value: boolean) {
		this.uint8(path, value ? 1: 0);
	}

	float(path: string, value: number) {
		this.current_path = path;
		this.safewrite(4, () => {
			this._buffer.writeFloatBE(value, this._offset);
		});
	}

	double(path: string, value: number) {
		this.current_path = path;
		this.safewrite(8, () => {
			this._buffer.writeDoubleBE(value, this._offset);
		});
	}

	decimal(path: string, value: number) {
		this.current_path = path;
		if (value > 0) {
			let long_value = Math.floor(value);
			if (long_value > MAX_UINT32) {
				throw new RangeError(`Decimal should be less then ${MAX_UINT32 + 1} for ${path}`);
			}

			const fraction = (value - long_value).toFixed(256).slice(2).replace(/0+$/, "");
			let fraction_size = 0;

			for (let i = 0; i < fraction.length; i++) {
				const long_next = (long_value * 10) + parseInt(fraction[i]);
				if (long_next > MAX_UINT32) {
					break;
				}
				long_value = long_next;
				fraction_size++;
			}

			this.safewrite(5, ()=>{
				this._buffer.writeUInt8(fraction_size, this._offset);
				this._buffer.writeUInt32BE(long_value, this._offset + 1);
			});
		} else if (value === 0) {
			this.safewrite(5, ()=>{
				this._buffer.writeUIntBE(0, this._offset, 5);
			});
		} else {
			throw new RangeError(`Decimal should be positive for [${path}]`);
		}
	}

	void() {}

	binary(path: string, value: Buffer) {
		const length = value.length;
		if (length){
			this.safewrite(length + 4, ()=>{
				this.current_path = path + ".length";
				this._buffer.writeUInt32BE(length, this._offset);
				this.current_path = path;
				this._buffer.set(value, this._offset + 4);
			});
		} else {
			return this.uint32(path + ".length", 0);
		}
	}

	private tableitem(path: string, value: any) {
		this.current_path = path;
		let char: string;
		const type = typeof (value);
		if (type === 'bigint') {
			char = 'L';
		} else if (type === 'boolean') {
			char = 't';
		} else if (type === 'function' || type === 'symbol' || type === 'undefined') {
			throw new RangeError(`${type} not supported to encode for [${path}]`);
		} else if (type === 'number') {
			if (Number.isInteger(value)) {
				const signed = (value < 0);
				if (signed) {
					// int signed
					if ((value > -129)) {
						char = 'b';
					} else if ((value > -32769)) {
						char = 's';
					} else if ((value > -2147483649)) {
						char = 'I';
					} else {
						char = 'd';
					}
				} else {
					// int unsigned
					if (value < 256) {
						char = 'B';
					} else if (value < 65536) {
						char = 'u';
					} else if (value < 4294967296) {
						char = 'i';
					} else {
						char = 'd';
					}
				}
			} else {
				// not integer
				char = 'd';
			}
		} else if (type === 'string') {
			char = 'S';
		} else { // type === 'object'
			if (value) {
				if (value instanceof Buffer) {
					char = 'x';
				} else if (value instanceof Date) {
					char = 'T';
				} else if (Array.isArray(value)) {
					char = 'A';
				} else {
					char = 'F';
				}
			} else {
				char = 'V';
			}
		}
		const char_code = char.charCodeAt(0);
		const method = CHAR_METHODS.get(char_code);
		if (method === undefined) {
			throw new RangeError(`Unknown char [${char}] for ${path}`);
		}
		this.uint8(path + ".char", char_code);
		this[method](path, value);
	}

	tableitems(path: string, value: any) {
		this.current_path = path;
		for (const key in value) {
			if (!RE_FieldName.test(key)) {
				throw new RangeError(`Invalid field table key [${key}]`);
			}
			const value_path = `${path}.${key}`;
			this.shortstr(value_path + ".field", key);
			this.tableitem(value_path + `.value`, value[key]);
		}
	}

	table(path: string, value: any) {
		const offset_length = this._offset;
		const start = this._offset = this._offset + 4;
		this.tableitems(path, value);
		this._buffer.writeUInt32BE(this._offset - start, offset_length);
	}

	array(path: string, value: any[]) {
		const offset_length = this._offset;
		const start = this._offset = this._offset + 4;
		for (let i = 0; i < value.length; i++){
			this.tableitem(`${path}[${i}]`, value[i]);
		}
		this._buffer.writeUInt32BE(this._offset - start, offset_length);
	}

	bits8(path: string, keys: string[], source: object) {
		let flag = 0;
		for (let i = 0; i < keys.length; i++) {
			if (source[keys[i]]){
				flag = flag | BITS8[i];
			}
		}
		this.uint8(path + '.flag', flag);
	}

	properties(path: string, items: { key: string, method: string }[], source: object) {
		let flag = 0;

		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			if (!(item.key in source)){
				continue;
			}
			flag = flag | BITS_BASIC[i];
			this[item.method](`${path}.${item.key}`, source[item.key]);
		}

		this.uint16(path + '.flag', flag);
	}

	skip(size = 1){
		this.safewrite(size, ()=>{
			this._offset = this._buffer.writeUIntBE(0, this._offset, size);
		});
	}

	framestart(frame_type: number, channel: number, size: number){
		this._buffer.writeUInt8(frame_type, 0);
		this._buffer.writeUInt16BE(channel, 1);
		this._buffer.writeUInt32BE(size, 3);
		this._offset = 7;
	}

	methodstart(channel: number, size: number, method_id: number){
		this.framestart(FRAME_TYPES.frame_method, channel, size);
		this._buffer.writeUInt32BE(method_id, 7);
		this._offset = 11;
	}

	headerstart(channel: number, class_id: number, body_size: number){
		this.framestart(FRAME_TYPES.frame_header, channel, 0);
		this.uint16("class_id", class_id);
		this.uint16("weight", 0);
		this.uint64("body_size", BigInt(body_size));
	}

	heartbeat(){
		this.framestart(FRAME_TYPES.frame_heartbeat, 0, 0);
		this.frameend();
		return this;
	}

	frameend(){
		this.uint8("end", FRAME_CONST.frame_end);
	}

	setframelength(){
		this._buffer.writeUInt32BE(this.offset - EMPTY_FRAME_SIZE, 3);
	}

	jsstring(path: string, value: string){
		this.current_path = path;
		const size = Buffer.byteLength(value, ENCODING);
		this.safewrite(size, ()=>{
			this._buffer.write(value, this._offset, ENCODING);
		});
	}
}

export interface ICodec<T = any> {
	decode: (reader: BufferReader, path: string)=>T,
	encode: (writer: BufferWriter, path: string, value: T)=>void
}

const RE_XQ_NAME = new RegExp("^[a-zA-Z0-9-_.:]*$");

export const ASSERTS = {
	length: (path: string, value: string)=>{
		if (value.length > 127){
			throw new RangeError(`Length of ${path} should not be > 127`);
		}
	},
	regexp: (path: string, value: string)=>{
		if (!RE_XQ_NAME.test(value)) {
			throw new RangeError(`Invalid format of ${path}`);
		}
	},
	notnull: (path: string, value: string | number)=>{
		if (!value) {
			throw new RangeError(`Value of ${path} should not be empty`);
		}
	},
	le: (path: string)=>{
		throw new SyntaxError(`Le checking of ${path} not supported`);
	}
};

const isSocketOpened = (socket: Socket)=>{
	return socket.readyState === 'open';
};

export async function writeSocket(socket: Socket, writer: BufferWriter) {
	if (!isSocketOpened(socket)) return;
	const buffer = writer.dynamic ? writer.buffer.subarray(0, writer.offset) : writer.buffer;
	return new Promise<void>((resolve, reject) => {
		if (!isSocketOpened(socket)) return resolve();
		socket.write(buffer, (error: Error) => {
			if (error){
				reject (error);
			} else {
				resolve();
			}
		});
	});
}

export async function writeVoid(method_id: number, socket: Socket, channel: number) {
	const writer = new BufferWriter(EMPTY_FRAME_METHOD_SIZE, false);
	writer.methodstart(channel, EMPTY_FRAME_METHOD_PAYLOAD_SIZE, method_id);
	writer.frameend();
	return writeSocket(socket, writer);
}

export async function writeBodyOne(socket: Socket, channel: number, body: Buffer){
	const writer = new BufferWriter(EMPTY_FRAME_SIZE + body.byteLength, false);
	writer.framestart(FRAME_TYPES.frame_body, channel, body.byteLength);
	writer.buffer.set(body, writer.offset);
	writer.buffer.writeUInt8(FRAME_CONST.frame_end, writer.offset + body.byteLength);
	return writeSocket(socket, writer);
}

export async function writeBody(socket: Socket, channel: number, body: Buffer, frame_max: number){
	if (body.length <= frame_max){
		return writeBodyOne(socket, channel, body);
	}

	let start = 0;
	while (start < body.length){
		const end = start + frame_max;
		await writeBodyOne(socket, channel, body.subarray(start, end));
		start = end;
	}
}

export async function writeHeartbeat(socket: Socket){
	const writer = new BufferWriter(EMPTY_FRAME_SIZE, false);
	writer.heartbeat();
	return writeSocket(socket, writer);
}
