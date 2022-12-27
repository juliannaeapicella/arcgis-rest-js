"use strict";
/* Copyright (c) 2018 Environmental Systems Research Institute, Inc.
 * Apache-2.0 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAttachments = void 0;
const arcgis_rest_request_1 = require("@esri/arcgis-rest-request");
/**
 * Request `attachmentInfos` of a feature by id. See [Attachment Infos](https://developers.arcgis.com/rest/services-reference/attachment-infos-feature-service-.htm) for more information.
 *
 * ```js
 * import { getAttachments } from '@esri/arcgis-rest-feature-service';
 * //
 * getAttachments({
 *   url: "https://sampleserver6.arcgisonline.com/arcgis/rest/services/ServiceRequest/FeatureServer/0",
 *   featureId: 8484
 * });
 * ```
 *
 * @param requestOptions - Options for the request.
 * @returns A Promise that will resolve with the `getAttachments()` response.
 */
function getAttachments(requestOptions) {
    const options = Object.assign({ httpMethod: "GET" }, requestOptions);
    // pass through
    return (0, arcgis_rest_request_1.request)(`${(0, arcgis_rest_request_1.cleanUrl)(options.url)}/${options.featureId}/attachments`, options);
}
exports.getAttachments = getAttachments;
//# sourceMappingURL=getAttachments.js.map