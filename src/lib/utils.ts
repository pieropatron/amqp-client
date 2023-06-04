
/**
 * Clone array
 * @param arr to clone
 * @returns
 */
function CloneArray<Tresult = any>(arr: Tresult[]) {
	const result: Tresult[] = [];
	for (const el of arr) {
		const type = typeof (el);
		if (type === 'object' && el) {
			if (Array.isArray(el)) {
				result.push(CloneArray(el) as any);
			} else {
				result.push(CloneObject(el));
			}
		} else {
			result.push(el);
		}
	}
	return result;
}

/**
 * Clone object
 * @param source object to clone
 * @returns
 */
export function CloneObject<Tresult extends object>(source: Tresult) {
	if (source instanceof (Date)) {
		return new Date(source.valueOf()) as Tresult;
	} else if (source instanceof (Buffer)) {
		const clone = Buffer.allocUnsafe(source.length);
		clone.set(source, 0);
		return clone as Tresult;
	} else if (typeof ((source as any).clone) === 'function') {
		return (source as any).clone() as Tresult;
	}

	const result: Tresult = {} as any;
	for (const key in source) {
		const value = source[key] as any;
		const type = typeof (value);
		if (type === 'object' && value) {
			if (Array.isArray(value)) {
				result[key] = CloneArray(value) as any;
			} else {
				result[key] = CloneObject(value as any);
			}
		} else {
			result[key] = value;
		}
	}
	return result;
}

/**
 * Merge objects
 * @param objects for merge
 * @returns new object as result of merge
 */
export function MergeObjects<Tresult extends object>(...objects: Partial<Tresult>[]) {
	if (objects.length < 2) {
		throw new Error(`Invalid use, required at least two object for merge`);
	}

	const result: Tresult = CloneObject(objects.pop() as any);

	for (let i = objects.length; i > 0; i--) {
		const object = objects[i - 1] as Tresult;
		for (const key in object) {
			if (key in result) {
				continue;
			} else {
				const value = object[key];
				const type = typeof (value);
				if (type === 'object' && value) {
					if (Array.isArray(value)) {
						result[key] = CloneArray(value) as any;
					} else {
						result[key] = CloneObject(value);
					}
				} else {
					result[key] = value;
				}
			}
		}
	}

	return result;
}

/**
 * Date constants
 */
export const DATE_CONST = Object.freeze({
	/** Second */
	SECOND: 1000,
	/** Heartbeat margin of error denominator */
	HB_MOF_DENOMINATOR: 100,
	/** Heartbeat margin of error min value */
	HB_MOF_MIN: 50,
	/** Heartbeat margin of error max value */
	HB_MOF_MAX: 1000
});


export const getRandomRange = (min: number, max: number) => {
	return Math.random() * (max - min) + min;
};
