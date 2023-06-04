import { XMLParser } from 'fast-xml-parser';
import * as fsp from 'fs/promises';

const ATTRKEY = ":@";

export type Comment = { type: string, lines: string[] }

export type XmlElement<T=any> = {
	key: string,
	comments: Comment[],
	attributes: T,
	constant: XmlElement[],
	domain: XmlElement[],
	class: XmlElement[],
	rule: XmlElement[],
	assert: XmlElement[],
	chassis: XmlElement[],
	response: XmlElement[],
	field: XmlElement[],
	method: XmlElement[]
}

const reduce_xml = (source: any)=>{
	const result: XmlElement = {
		key: "",
		comments: [],
		attributes: source[ATTRKEY] || {},
		constant: [],
		domain: [],
		class: [],
		rule: [],
		assert: [],
		chassis: [],
		response: [],
		field: [],
		method: []
	};

	delete source[ATTRKEY];
	const keys = Object.keys(source);
	if (keys.length > 1){
		console.log(source, keys);
		throw new Error(`Unknown structrure`);
	}
	result.key = keys[0];
	const ar: any[] = source[result.key];
	if (!Array.isArray(ar)){
		console.log(source);
		throw new Error(`Unexpected data type!`);
	}
	let comments: Comment[] = [];

	for (let i=0; i<ar.length; i++){
		const child = ar[i];
		if (child.$comment){
			comments.push(read_comment(child));
		} else if (child.$text) {
			result.comments.push({lines: reduce_text(child.$text), type: 'text'});
		} else {
			if (child.doc){
				const attrs = child[ATTRKEY];
				const type = attrs && attrs.type || "doc";
				result.comments.push({lines: reduce_text(child.doc[0].$text), type});
			} else {
				const reduced = reduce_xml(child);
				reduced.comments = comments.concat(reduced.comments);
				const ar: XmlElement[] = result[reduced.key];
				if (!ar){
					throw new Error(`Unknown child key ${reduced.key}`);
				}
				ar.push(reduced);
			}
			comments = [];
		}
	}
	if (result.attributes.label){
		result.comments.push({
			type: 'label',
			lines: [result.attributes.label]
		});
		delete result.attributes.label;
	}
	return result;
};

const reduce_text = (text:string)=>{
	return text.split('\n').map(line=>{
		return line.trim();
	});
};

const read_comment = (obj: any)=>{
	return {type: "comment", lines: reduce_text(obj.$comment[0].$text)};
};

const SET_KNOWN_KEYS: Set<string> = new Set([
	"$comment.[].$text",
	"?xml.[].$text",
	"?xml.version",
	"amqp.[].$comment",
	"amqp.[].class",
	"amqp.[].constant",
	"amqp.[].domain",
	"amqp.comment",
	"amqp.major",
	"amqp.minor",
	"amqp.port",
	"amqp.revision",
	"assert.check",
	"assert.field",
	"assert.method",
	"assert.value",
	"chassis.implement",
	"chassis.name",
	"class.[].$comment",
	"class.[].chassis",
	"class.[].doc",
	"class.[].field",
	"class.[].method",
	"class.[].rule",
	"class.handler",
	"class.index",
	"class.label",
	"class.name",
	"constant.[].doc",
	"constant.class",
	"constant.name",
	"constant.value",
	"doc.[].$text",
	"doc.type",
	"domain.[].assert",
	"domain.[].doc",
	"domain.[].rule",
	"domain.label",
	"domain.name",
	"domain.type",
	"field.[].assert",
	"field.[].doc",
	"field.[].rule",
	"field.domain",
	"field.label",
	"field.name",
	"field.required",
	"field.reserved",
	"field.type",
	"method.[].$comment",
	"method.[].$text",
	"method.[].chassis",
	"method.[].doc",
	"method.[].field",
	"method.[].response",
	"method.[].rule",
	"method.content",
	"method.deprecated",
	"method.index",
	"method.label",
	"method.name",
	"method.synchronous",
	"response.name",
	"rule.[].$comment",
	"rule.[].doc",
	"rule.name",
	"rule.on-failure",
	"xml.[].$comment",
	"xml.[].?xml",
	"xml.[].amqp"
]);
const SET_ELEMENT_KEYS: Set<string> = new Set();

const check_keys = (parent_key: string, elements: any[], set_keys: Set<string>, set_unknown: Set<string>) => {
	const check_key = (key:string)=>{
		set_keys.add(key);
		if (!SET_KNOWN_KEYS.has(key)){
			set_unknown.add(key);
		}
	};
	for (const element of elements){
		const type = typeof(element);
		if (type === 'object'){
			const keys = new Set(Object.keys(element));
			if (keys.has(ATTRKEY)){
				keys.delete(ATTRKEY);
			}

			if (keys.size !== 1){
				console.log(element);
				throw new Error(`Unknown structure`);
			}
			const key = Array.from(keys)[0];
			check_key(`${parent_key}.[].${key}`);
			const data = element[key];
			const attrs = element[ATTRKEY];
			for (const attrkey in attrs) {
				check_key(`${key}.${attrkey}`);
			}

			if (Array.isArray(data)){
				check_keys(key, data, set_keys, set_unknown);
			}
		} else {
			throw new Error(`Invalid use`);
		}
	}
};


export const ReadXml = async filepath=>{
	const data = await fsp.readFile(filepath);

	const parser = new XMLParser({
		preserveOrder: true,
		allowBooleanAttributes: true,
		alwaysCreateTextNode: true,
		cdataPropName: "$cdata",
		commentPropName: "$comment",
		textNodeName: "$text",
		ignoreAttributes: false,
		attributeNamePrefix: "",
		parseAttributeValue: true,
		processEntities: true,
		trimValues: true,
		parseTagValue: true
	});

	const xml = parser.parse(data);
	const set_keys: Set<string> = new Set();
	const set_unknown: Set<string> = new Set();

	check_keys("xml", xml, set_keys, set_unknown);

	if (set_unknown.size) {
		// console.log(Array.from(set_unknown).sort());
		console.log(Array.from(SET_ELEMENT_KEYS).sort().map(el=>`"${el}"`).join(",\n"));
		throw new Error(`Unknown keys detected`);
	} else if (set_keys.size !== SET_KNOWN_KEYS.size) {
		const removed: string[] = [];
		SET_KNOWN_KEYS.forEach(key => {
			if (!set_keys.has(key)) {
				removed.push(key);
			}
		});
		console.log(removed.sort());
		throw new Error(`Removed keys detected`);
	}

	const attr = xml[5][ATTRKEY] || {};
	// const attr = xml[5].amqp[ATTRKEY] || {};
	const amqp = reduce_xml(xml[5]);
	amqp.attributes = attr;

	return {
		warning: read_comment(xml[1]).lines,
		licence: read_comment(xml[2]).lines,
		readme: read_comment(xml[3]).lines.concat(read_comment(xml[4]).lines),
		amqp
	};
};
