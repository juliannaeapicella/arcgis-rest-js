/* Copyright (c) 2017-2018 Environmental Systems Research Institute, Inc.
 * Apache-2.0 */
/**
 * `requestOptions.owner` is given priority, `requestOptions.item.owner` will be checked next. If neither are present, `authentication.getUserName()` will be used instead.
 */
export function determineOwner(requestOptions) {
    if (requestOptions.owner) {
        return Promise.resolve(requestOptions.owner);
    }
    else if (requestOptions.item && requestOptions.item.owner) {
        return Promise.resolve(requestOptions.item.owner);
    }
    else if (requestOptions.authentication &&
        requestOptions.authentication.getUsername) {
        return requestOptions.authentication.getUsername();
    }
    else {
        return Promise.reject(new Error("Could not determine the owner of this item. Pass the `owner`, `item.owner`, or `authentication` option."));
    }
}
/**
 * checks if the extent is a valid BBox (2 element array of coordinate pair arrays)
 * @param extent
 * @returns
 */
export function isBBox(extent) {
    return (Array.isArray(extent) &&
        Array.isArray(extent[0]) &&
        Array.isArray(extent[1]));
}
/**
 * Given a Bbox, convert it to a string. Some api endpoints expect a string
 *
 * @param {BBox} extent
 * @return {*}  {string}
 */
export function bboxToString(extent) {
    return extent.join(",");
}
//# sourceMappingURL=helpers.js.map