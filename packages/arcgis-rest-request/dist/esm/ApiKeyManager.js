/* Copyright (c) 2017-2019 Environmental Systems Research Institute, Inc.
 * Apache-2.0 */
/**
 * Used to authenticate methods in ArcGIS REST JS with an API keys. The instance of `ApiKeyManager` can be passed to  {@linkcode IRequestOptions.authentication} to authenticate requests.
 *
 * ```js
 * import { ApiKeyManager } from '@esri/arcgis-rest-request';
 
 * const apiKey = new ApiKeyManager.fromKey("...");
 * ```
 *
 * In most cases however the API key can be passed directly to the {@linkcode IRequestOptions.authentication}.
 */
export class ApiKeyManager {
    constructor(options) {
        /**
         * The current portal the user is authenticated with.
         */
        this.portal = "https://www.arcgis.com/sharing/rest";
        this.key = options.key;
    }
    /**
     * The preferred method for creating an instance of `ApiKeyManager`.
     */
    static fromKey(apiKey) {
        return new ApiKeyManager({ key: apiKey });
    }
    /**
     * Gets a token (the API Key).
     */
    getToken(url) {
        return Promise.resolve(this.key);
    }
}
/**
 * @deprecated - Use {@linkcode ApiKeyManager}.
 * @internal
 */ /* istanbul ignore next */
export function ApiKey(options) {
    console.log("DEPRECATED:, 'ApiKey' is deprecated. Use 'ApiKeyManager' instead.");
    return new ApiKeyManager(options);
}
//# sourceMappingURL=ApiKeyManager.js.map