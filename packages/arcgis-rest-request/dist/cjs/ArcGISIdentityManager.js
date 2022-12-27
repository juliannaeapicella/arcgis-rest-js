"use strict";
/* Copyright (c) 2017-2019 Environmental Systems Research Institute, Inc.
 * Apache-2.0 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserSession = exports.ArcGISIdentityManager = void 0;
const request_js_1 = require("./request.js");
const decode_query_string_js_1 = require("./utils/decode-query-string.js");
const encode_query_string_js_1 = require("./utils/encode-query-string.js");
const fetch_token_js_1 = require("./fetch-token.js");
const federation_utils_js_1 = require("./federation-utils.js");
const validate_app_access_js_1 = require("./validate-app-access.js");
const clean_url_js_1 = require("./utils/clean-url.js");
const revoke_token_js_1 = require("./revoke-token.js");
const generate_code_challenge_js_1 = require("./utils/generate-code-challenge.js");
const generate_random_string_js_1 = require("./utils/generate-random-string.js");
const ArcGISAccessDeniedError_js_1 = require("./utils/ArcGISAccessDeniedError.js");
const ArcGISTokenRequestError_js_1 = require("./utils/ArcGISTokenRequestError.js");
const index_js_1 = require("./index.js");
/**
 * Used to authenticate both ArcGIS Online and ArcGIS Enterprise users. `ArcGISIdentityManager` includes helper methods for [OAuth 2.0](https://developers.arcgis.com/documentation/mapping-apis-and-services/security/oauth-2.0/) in both browser and server applications.
 *
 * **It is not recommended to construct `ArcGISIdentityManager` directly**. Instead there are several static methods used for specific workflows. The 2 primary workflows relate to oAuth 2.0:
 *
 * * {@linkcode ArcGISIdentityManager.beginOAuth2} and {@linkcode ArcGISIdentityManager.completeOAuth2()} for oAuth 2.0 in browser-only environment.
 * * {@linkcode ArcGISIdentityManager.authorize} and {@linkcode ArcGISIdentityManager.exchangeAuthorizationCode} for oAuth 2.0 for server-enabled application.
 *
 * Other more specialized helpers for less common workflows also exist:
 *
 * * {@linkcode ArcGISIdentityManager.fromToken} for when you have an existing token from another source and would like create an `ArcGISIdentityManager` instance.
 * * {@linkcode ArcGISIdentityManager.fromCredential} for creating  an `ArcGISIdentityManager` instance from a `Credentials` object in the ArcGIS JS API `IdentityManager`
 * * {@linkcode ArcGISIdentityManager.signIn} for authenticating directly with a users username and password for environments with a user interface for oAuth 2.0.
 *
 * Once a manager is created there are additional utilities:
 *
 * * {@linkcode ArcGISIdentityManager.serialize} can be used to create a JSON object representing an instance of `ArcGISIdentityManager`
 * * {@linkcode ArcGISIdentityManager.deserialize} will create a new `ArcGISIdentityManager` from a JSON object created with {@linkcode ArcGISIdentityManager.serialize}
 * * {@linkcode ArcGISIdentityManager.destroy} or {@linkcode ArcGISIdentityManager.signOut} will invalidate any tokens in use by the  `ArcGISIdentityManager`.
 */
class ArcGISIdentityManager {
    constructor(options) {
        this.clientId = options.clientId;
        this._refreshToken = options.refreshToken;
        this._refreshTokenExpires = options.refreshTokenExpires;
        this._username = options.username;
        this.password = options.password;
        this._token = options.token;
        this._tokenExpires = options.tokenExpires;
        this.portal = options.portal
            ? (0, clean_url_js_1.cleanUrl)(options.portal)
            : "https://www.arcgis.com/sharing/rest";
        this.ssl = options.ssl;
        this.provider = options.provider || "arcgis";
        this.tokenDuration = options.tokenDuration || 20160;
        this.redirectUri = options.redirectUri;
        this.server = options.server;
        this.federatedServers = {};
        this.trustedDomains = [];
        // if a non-federated server was passed explicitly, it should be trusted.
        if (options.server) {
            // if the url includes more than '/arcgis/', trim the rest
            const root = this.getServerRootUrl(options.server);
            this.federatedServers[root] = {
                token: options.token,
                expires: options.tokenExpires
            };
        }
        this._pendingTokenRequests = {};
    }
    /**
     * The current ArcGIS Online or ArcGIS Enterprise `token`.
     */
    get token() {
        return this._token;
    }
    /**
     * The expiration time of the current `token`.
     */
    get tokenExpires() {
        return this._tokenExpires;
    }
    /**
     * The current token to ArcGIS Online or ArcGIS Enterprise.
     */
    get refreshToken() {
        return this._refreshToken;
    }
    /**
     * The expiration time of the current `refreshToken`.
     */
    get refreshTokenExpires() {
        return this._refreshTokenExpires;
    }
    /**
     * The currently authenticated user.
     */
    get username() {
        if (this._username) {
            return this._username;
        }
        if (this._user && this._user.username) {
            return this._user.username;
        }
    }
    /**
     * Returns `true` if these credentials can be refreshed and `false` if it cannot.
     */
    get canRefresh() {
        if (this.username && this.password) {
            return true;
        }
        if (this.clientId && this.refreshToken && this.redirectUri) {
            return true;
        }
        return false;
    }
    /**
     * Begins a new browser-based OAuth 2.0 sign in. If `options.popup` is `true` the authentication window will open in a new tab/window. Otherwise, the user will be redirected to the authorization page in their current tab/window and the function will return `undefined`.
     *
     * If `popup` is `true` (the default) this method will return a `Promise` that resolves to an `ArcGISIdentityManager` instance and you must call {@linkcode ArcGISIdentityManager.completeOAuth2()} on the page defined in the `redirectUri`. Otherwise it will return undefined and the {@linkcode ArcGISIdentityManager.completeOAuth2()} method will return a `Promise` that resolves to an `ArcGISIdentityManager` instance.
     *
     * A {@linkcode ArcGISAccessDeniedError} error will be thrown if the user denies the request on the authorization screen.
     *
     * @browserOnly
     */
    static beginOAuth2(options, win) {
        /* istanbul ignore next: must pass in a mockwindow for tests so we can't cover the other branch */
        if (!win && window) {
            win = window;
        }
        const { portal, provider, clientId, expiration, redirectUri, popup, popupWindowFeatures, locale, params, style, pkce, state } = Object.assign({
            portal: "https://www.arcgis.com/sharing/rest",
            provider: "arcgis",
            expiration: 20160,
            popup: true,
            popupWindowFeatures: "height=400,width=600,menubar=no,location=yes,resizable=yes,scrollbars=yes,status=yes",
            locale: "",
            style: "",
            pkce: true
        }, options);
        /**
         * Generate a  random string for the `state` param and store it in local storage. This is used
         * to validate that all parts of the oAuth process were performed on the same client.
         */
        const stateId = state || (0, generate_random_string_js_1.generateRandomString)(win);
        const stateStorageKey = `ARCGIS_REST_JS_AUTH_STATE_${clientId}`;
        win.localStorage.setItem(stateStorageKey, stateId);
        // Start setting up the URL to the authorization screen.
        let authorizeUrl = `${(0, clean_url_js_1.cleanUrl)(portal)}/oauth2/authorize`;
        const authorizeUrlParams = {
            client_id: clientId,
            response_type: pkce ? "code" : "token",
            expiration: expiration,
            redirect_uri: redirectUri,
            state: JSON.stringify({
                id: stateId,
                originalUrl: win.location.href // this is used to reset the URL back the original URL upon return
            }),
            locale: locale,
            style: style
        };
        // If we are authorizing through a specific social provider update the params and base URL.
        if (provider !== "arcgis") {
            authorizeUrl = `${(0, clean_url_js_1.cleanUrl)(portal)}/oauth2/social/authorize`;
            authorizeUrlParams.socialLoginProviderName = provider;
            authorizeUrlParams.autoAccountCreateForSocial = true;
        }
        /**
         * set a value that will be set to a promise which will later resolve when we are ready
         * to send users to the authorization page.
         */
        let setupAuth;
        if (pkce) {
            /**
             * If we are authenticating with PKCE we need to generate the code challenge which is
             * async so we generate the code challenge and assign the resulting Promise to `setupAuth`
             */
            const codeVerifier = (0, generate_random_string_js_1.generateRandomString)(win);
            const codeVerifierStorageKey = `ARCGIS_REST_JS_CODE_VERIFIER_${clientId}`;
            win.localStorage.setItem(codeVerifierStorageKey, codeVerifier);
            setupAuth = (0, generate_code_challenge_js_1.generateCodeChallenge)(codeVerifier, win).then(function (codeChallenge) {
                authorizeUrlParams.code_challenge_method = codeChallenge
                    ? "S256"
                    : "plain";
                authorizeUrlParams.code_challenge = codeChallenge
                    ? codeChallenge
                    : codeVerifier;
            });
        }
        else {
            /**
             * If we aren't authenticating with PKCE we can just assign a resolved promise to `setupAuth`
             */
            setupAuth = Promise.resolve();
        }
        /**
         * Once we are done setting up with (for PKCE) we can start the auth process.
         */
        return setupAuth.then(() => {
            // combine the authorize URL and params
            authorizeUrl = `${authorizeUrl}?${(0, encode_query_string_js_1.encodeQueryString)(authorizeUrlParams)}`;
            // append additional params passed by the user
            if (params) {
                authorizeUrl = `${authorizeUrl}&${(0, encode_query_string_js_1.encodeQueryString)(params)}`;
            }
            if (popup) {
                // If we are authenticating a popup we need to return a Promise that will resolve to an ArcGISIdentityManager later.
                return new Promise((resolve, reject) => {
                    // Add an event listener to listen for when a user calls `ArcGISIdentityManager.completeOAuth2()` in the popup.
                    win.addEventListener(`arcgis-rest-js-popup-auth-${clientId}`, (e) => {
                        if (e.detail.error === "access_denied") {
                            const error = new ArcGISAccessDeniedError_js_1.ArcGISAccessDeniedError();
                            reject(error);
                            return error;
                        }
                        if (e.detail.errorMessage) {
                            const error = new request_js_1.ArcGISAuthError(e.detail.errorMessage, e.detail.error);
                            reject(error);
                            return error;
                        }
                        resolve(new ArcGISIdentityManager({
                            clientId,
                            portal,
                            ssl: e.detail.ssl,
                            token: e.detail.token,
                            tokenExpires: e.detail.expires,
                            username: e.detail.username,
                            refreshToken: e.detail.refreshToken,
                            refreshTokenExpires: e.detail.refreshTokenExpires,
                            redirectUri
                        }));
                    }, {
                        once: true
                    });
                    // open the popup
                    win.open(authorizeUrl, "oauth-window", popupWindowFeatures);
                    win.dispatchEvent(new CustomEvent("arcgis-rest-js-popup-auth-start"));
                });
            }
            else {
                // If we aren't authenticating with a popup just send the user to the authorization page.
                win.location.href = authorizeUrl;
                return undefined;
            }
        });
    }
    /**
     * Completes a browser-based OAuth 2.0 sign in. If `options.popup` is `true` the user
     * will be returned to the previous window and the popup will close. Otherwise a new `ArcGISIdentityManager` will be returned. You must pass the same values for `clientId`, `popup`, `portal`, and `pkce` as you used in `beginOAuth2()`.
     *
     * A {@linkcode ArcGISAccessDeniedError} error will be thrown if the user denies the request on the authorization screen.
     * @browserOnly
     */
    static completeOAuth2(options, win) {
        /* istanbul ignore next: must pass in a mockwindow for tests so we can't cover the other branch */
        if (!win && window) {
            win = window;
        }
        // pull out necessary options
        const { portal, clientId, popup, pkce, redirectUri } = Object.assign({
            portal: "https://www.arcgis.com/sharing/rest",
            popup: true,
            pkce: true
        }, options);
        // pull the saved state id out of local storage
        const stateStorageKey = `ARCGIS_REST_JS_AUTH_STATE_${clientId}`;
        const stateId = win.localStorage.getItem(stateStorageKey);
        // get the params provided by the server and compare the server state with the client saved state
        const params = (0, decode_query_string_js_1.decodeQueryString)(pkce
            ? win.location.search.replace(/^\?/, "")
            : win.location.hash.replace(/^#/, ""));
        const state = params && params.state ? JSON.parse(params.state) : undefined;
        function reportError(errorMessage, error, originalUrl) {
            win.localStorage.removeItem(stateStorageKey);
            if (popup && win.opener) {
                win.opener.dispatchEvent(new CustomEvent(`arcgis-rest-js-popup-auth-${clientId}`, {
                    detail: {
                        error,
                        errorMessage
                    }
                }));
                win.close();
                return;
            }
            if (originalUrl) {
                win.history.replaceState(win.history.state, "", originalUrl);
            }
            if (error === "access_denied") {
                return Promise.reject(new ArcGISAccessDeniedError_js_1.ArcGISAccessDeniedError());
            }
            return Promise.reject(new request_js_1.ArcGISAuthError(errorMessage, error));
        }
        // create a function to create the final ArcGISIdentityManager from the token info.
        function createManager(oauthInfo, originalUrl) {
            win.localStorage.removeItem(stateStorageKey);
            if (popup && win.opener) {
                win.opener.dispatchEvent(new CustomEvent(`arcgis-rest-js-popup-auth-${clientId}`, {
                    detail: Object.assign({}, oauthInfo)
                }));
                win.close();
                return;
            }
            win.history.replaceState(win.history.state, "", originalUrl);
            return new ArcGISIdentityManager({
                clientId,
                portal,
                ssl: oauthInfo.ssl,
                token: oauthInfo.token,
                tokenExpires: oauthInfo.expires,
                username: oauthInfo.username,
                refreshToken: oauthInfo.refreshToken,
                refreshTokenExpires: oauthInfo.refreshTokenExpires,
                // At 4.0.0 it was possible (in JS code) to not pass redirectUri and fallback to win.location.href, however this broke support for redirect URIs with query params.
                // Now similar to 3.x.x you must pass the redirectUri parameter explicitly. See https://github.com/Esri/arcgis-rest-js/issues/995
                redirectUri: redirectUri ||
                    /* istanbul ignore next: TypeScript wont compile if we omit redirectUri */ location.href.replace(location.search, "")
            });
        }
        if (!stateId || !state) {
            return reportError("No authentication state was found, call `ArcGISIdentityManager.beginOAuth2(...)` to start the authentication process.", "no-auth-state");
        }
        if (state.id !== stateId) {
            return reportError("Saved client state did not match server sent state.", "mismatched-auth-state");
        }
        if (params.error) {
            const error = params.error;
            const errorMessage = params.error_description || "Unknown error";
            return reportError(errorMessage, error, state.originalUrl);
        }
        /**
         * If we are using PKCE the authorization code will be in the query params.
         * For implicit grants the token will be in the hash.
         */
        if (pkce && params.code) {
            const tokenEndpoint = (0, clean_url_js_1.cleanUrl)(`${portal}/oauth2/token/`);
            const codeVerifierStorageKey = `ARCGIS_REST_JS_CODE_VERIFIER_${clientId}`;
            const codeVerifier = win.localStorage.getItem(codeVerifierStorageKey);
            win.localStorage.removeItem(codeVerifierStorageKey);
            // exchange our auth code for a token + refresh token
            return (0, fetch_token_js_1.fetchToken)(tokenEndpoint, {
                httpMethod: "POST",
                params: {
                    client_id: clientId,
                    code_verifier: codeVerifier,
                    grant_type: "authorization_code",
                    // using location.href here does not support query params but shipped with 4.0.0. See https://github.com/Esri/arcgis-rest-js/issues/995
                    redirect_uri: redirectUri || location.href.replace(location.search, ""),
                    code: params.code
                }
            })
                .then((tokenResponse) => {
                return createManager(Object.assign(Object.assign({}, tokenResponse), state), state.originalUrl);
            })
                .catch((e) => {
                return reportError(e.originalMessage, e.code, state.originalUrl);
            });
        }
        if (!pkce && params.access_token) {
            return Promise.resolve(createManager(Object.assign({ token: params.access_token, expires: new Date(Date.now() + parseInt(params.expires_in, 10) * 1000), ssl: params.ssl === "true", username: params.username }, state), state.originalUrl));
        }
        return reportError("Unknown error", "oauth-error", state.originalUrl);
    }
    /**
     * Request credentials information from the parent application
     *
     * When an application is embedded into another application via an IFrame, the embedded app can
     * use `window.postMessage` to request credentials from the host application. This function wraps
     * that behavior.
     *
     * The ArcGIS API for Javascript has this built into the Identity Manager as of the 4.19 release.
     *
     * Note: The parent application will not respond if the embedded app's origin is not:
     * - the same origin as the parent or *.arcgis.com (JSAPI)
     * - in the list of valid child origins (REST-JS)
     *
     *
     * @param parentOrigin origin of the parent frame. Passed into the embedded application as `parentOrigin` query param
     * @browserOnly
     */
    static fromParent(parentOrigin, win) {
        /* istanbul ignore next: must pass in a mockwindow for tests so we can't cover the other branch */
        if (!win && window) {
            win = window;
        }
        // Declare handler outside of promise scope so we can detach it
        let handler;
        // return a promise that will resolve when the handler receives
        // session information from the correct origin
        return new Promise((resolve, reject) => {
            // create an event handler that just wraps the parentMessageHandler
            handler = (event) => {
                // ensure we only listen to events from the parent
                if (event.source === win.parent && event.data) {
                    try {
                        return resolve(ArcGISIdentityManager.parentMessageHandler(event));
                    }
                    catch (err) {
                        return reject(err);
                    }
                }
            };
            // add listener
            win.addEventListener("message", handler, false);
            win.parent.postMessage({ type: "arcgis:auth:requestCredential" }, parentOrigin);
        }).then((manager) => {
            win.removeEventListener("message", handler, false);
            return manager;
        });
    }
    /**
     * Begins a new server-based OAuth 2.0 sign in. This will redirect the user to
     * the ArcGIS Online or ArcGIS Enterprise authorization page.
     *
     * @nodeOnly
     */
    static authorize(options, response) {
        const { portal, clientId, expiration, redirectUri, state } = Object.assign({ portal: "https://arcgis.com/sharing/rest", expiration: 20160 }, options);
        const queryParams = {
            client_id: clientId,
            expiration,
            response_type: "code",
            redirect_uri: redirectUri
        };
        if (state) {
            queryParams.state = state;
        }
        const url = `${portal}/oauth2/authorize?${(0, encode_query_string_js_1.encodeQueryString)(queryParams)}`;
        response.writeHead(301, {
            Location: url
        });
        response.end();
    }
    /**
     * Completes the server-based OAuth 2.0 sign in process by exchanging the `authorizationCode`
     * for a `access_token`.
     *
     * @nodeOnly
     */
    static exchangeAuthorizationCode(options, authorizationCode) {
        const { portal, clientId, redirectUri } = Object.assign({
            portal: "https://www.arcgis.com/sharing/rest"
        }, options);
        return (0, fetch_token_js_1.fetchToken)(`${portal}/oauth2/token`, {
            params: {
                grant_type: "authorization_code",
                client_id: clientId,
                redirect_uri: redirectUri,
                code: authorizationCode
            }
        })
            .then((response) => {
            return new ArcGISIdentityManager({
                clientId,
                portal,
                ssl: response.ssl,
                redirectUri,
                refreshToken: response.refreshToken,
                refreshTokenExpires: response.refreshTokenExpires,
                token: response.token,
                tokenExpires: response.expires,
                username: response.username
            });
        })
            .catch((e) => {
            throw new ArcGISTokenRequestError_js_1.ArcGISTokenRequestError(e.message, ArcGISTokenRequestError_js_1.ArcGISTokenRequestErrorCodes.REFRESH_TOKEN_EXCHANGE_FAILED, e.response, e.url, e.options);
        });
    }
    static deserialize(str) {
        const options = JSON.parse(str);
        return new ArcGISIdentityManager({
            clientId: options.clientId,
            refreshToken: options.refreshToken,
            refreshTokenExpires: options.refreshTokenExpires
                ? new Date(options.refreshTokenExpires)
                : undefined,
            username: options.username,
            password: options.password,
            token: options.token,
            tokenExpires: options.tokenExpires
                ? new Date(options.tokenExpires)
                : undefined,
            portal: options.portal,
            ssl: options.ssl,
            tokenDuration: options.tokenDuration,
            redirectUri: options.redirectUri,
            server: options.server
        });
    }
    /**
     * Translates authentication from the format used in the [`IdentityManager` class in the ArcGIS API for JavaScript](https://developers.arcgis.com/javascript/latest/api-reference/esri-identity-Credential.html).
     *
     * You will need to call both [`IdentityManger.findCredential`](https://developers.arcgis.com/javascript/latest/api-reference/esri-identity-IdentityManager.html#findCredential) and [`IdentityManger.findServerInfo`](https://developers.arcgis.com/javascript/latest/api-reference/esri-identity-IdentityManager.html#findServerInfo) to obtain both parameters for this method.
     *
     * This method can be used with {@linkcode ArcGISIdentityManager.toCredential} to interop with the ArcGIS API for JavaScript.
     *
     * ```js
     * require(["esri/id"], (esriId) => {
     *   const credential = esriId.findCredential("https://www.arcgis.com/sharing/rest");
     *   const serverInfo = esriId.findServerInfo("https://www.arcgis.com/sharing/rest");
     *
     *   const manager = ArcGISIdentityManager.fromCredential(credential, serverInfo);
     * });
     * ```
     *
     * @returns ArcGISIdentityManager
     */
    static fromCredential(credential, serverInfo) {
        // At ArcGIS Online 9.1, credentials no longer include the ssl and expires properties
        // Here, we provide default values for them to cover this condition
        const ssl = typeof credential.ssl !== "undefined" ? credential.ssl : true;
        const expires = credential.expires || Date.now() + 7200000; /* 2 hours */
        if (serverInfo.hasServer) {
            return new ArcGISIdentityManager({
                server: credential.server,
                ssl,
                token: credential.token,
                username: credential.userId,
                tokenExpires: new Date(expires)
            });
        }
        return new ArcGISIdentityManager({
            portal: (0, clean_url_js_1.cleanUrl)(credential.server.includes("sharing/rest")
                ? credential.server
                : credential.server + `/sharing/rest`),
            ssl,
            token: credential.token,
            username: credential.userId,
            tokenExpires: new Date(expires)
        });
    }
    /**
     * Handle the response from the parent
     * @param event DOM Event
     */
    static parentMessageHandler(event) {
        if (event.data.type === "arcgis:auth:credential") {
            return new ArcGISIdentityManager(event.data.credential);
        }
        if (event.data.type === "arcgis:auth:error") {
            const err = new Error(event.data.error.message);
            err.name = event.data.error.name;
            throw err;
        }
        else {
            throw new Error("Unknown message type.");
        }
    }
    /**
     * Revokes all active tokens for a provided {@linkcode ArcGISIdentityManager}. The can be considered the equivalent to signing the user out of your application.
     */
    static destroy(manager) {
        return (0, revoke_token_js_1.revokeToken)({
            clientId: manager.clientId,
            portal: manager.portal,
            token: manager.refreshToken || manager.token
        });
    }
    /**
     * Create a  {@linkcode ArcGISIdentityManager} from an existing token. Useful for when you have a users token from a different authentication system and want to get a  {@linkcode ArcGISIdentityManager}.
     */
    static fromToken(options) {
        const manager = new ArcGISIdentityManager(options);
        return manager.getUser().then(() => {
            return manager;
        });
    }
    /**
     * Initialize a {@linkcode ArcGISIdentityManager} with a users `username` and `password`. **This method is intended ONLY for applications without a user interface such as CLI tools.**.
     *
     * If possible you should use {@linkcode ArcGISIdentityManager.beginOAuth2} to authenticate users in a browser or {@linkcode ArcGISIdentityManager.authorize} for authenticating users with a web server.
     */
    static signIn(options) {
        const manager = new ArcGISIdentityManager(options);
        return manager.getUser().then(() => {
            return manager;
        });
    }
    /**
     * Returns authentication in a format useable in the [`IdentityManager.registerToken()` method in the ArcGIS API for JavaScript](https://developers.arcgis.com/javascript/latest/api-reference/esri-identity-IdentityManager.html#registerToken).
     *
     * This method can be used with {@linkcode ArcGISIdentityManager.fromCredential} to interop with the ArcGIS API for JavaScript.
     *
     * ```js
     * require(["esri/id"], (esriId) => {
     *   esriId.registerToken(manager.toCredential());
     * })
     
     * ```
     *
     * @returns ICredential
     */
    toCredential() {
        return {
            expires: this.tokenExpires.getTime(),
            server: this.server || this.portal,
            ssl: this.ssl,
            token: this.token,
            userId: this.username
        };
    }
    /**
     * Returns information about the currently logged in [user](https://developers.arcgis.com/rest/users-groups-and-items/user.htm). Subsequent calls will *not* result in additional web traffic.
     *
     * ```js
     * manager.getUser()
     *   .then(response => {
     *     console.log(response.role); // "org_admin"
     *   })
     * ```
     *
     * @param requestOptions - Options for the request. NOTE: `rawResponse` is not supported by this operation.
     * @returns A Promise that will resolve with the data from the response.
     */
    getUser(requestOptions) {
        if (this._pendingUserRequest) {
            return this._pendingUserRequest;
        }
        else if (this._user) {
            return Promise.resolve(this._user);
        }
        else {
            const url = `${this.portal}/community/self`;
            const options = Object.assign(Object.assign({ httpMethod: "GET", authentication: this }, requestOptions), { rawResponse: false });
            this._pendingUserRequest = (0, request_js_1.request)(url, options).then((response) => {
                this._user = response;
                this._pendingUserRequest = null;
                return response;
            });
            return this._pendingUserRequest;
        }
    }
    /**
     * Returns information about the currently logged in user's [portal](https://developers.arcgis.com/rest/users-groups-and-items/portal-self.htm). Subsequent calls will *not* result in additional web traffic.
     *
     * ```js
     * manager.getPortal()
     *   .then(response => {
     *     console.log(portal.name); // "City of ..."
     *   })
     * ```
     *
     * @param requestOptions - Options for the request. NOTE: `rawResponse` is not supported by this operation.
     * @returns A Promise that will resolve with the data from the response.
     */
    getPortal(requestOptions) {
        if (this._pendingPortalRequest) {
            return this._pendingPortalRequest;
        }
        else if (this._portalInfo) {
            return Promise.resolve(this._portalInfo);
        }
        else {
            const url = `${this.portal}/portals/self`;
            const options = Object.assign(Object.assign({ httpMethod: "GET", authentication: this }, requestOptions), { rawResponse: false });
            this._pendingPortalRequest = (0, request_js_1.request)(url, options).then((response) => {
                this._portalInfo = response;
                this._pendingPortalRequest = null;
                return response;
            });
            return this._pendingPortalRequest;
        }
    }
    /**
     * Returns the username for the currently logged in [user](https://developers.arcgis.com/rest/users-groups-and-items/user.htm). Subsequent calls will *not* result in additional web traffic. This is also used internally when a username is required for some requests but is not present in the options.
     *
     * ```js
     * manager.getUsername()
     *   .then(response => {
     *     console.log(response); // "casey_jones"
     *   })
     * ```
     */
    getUsername() {
        if (this.username) {
            return Promise.resolve(this.username);
        }
        else {
            return this.getUser().then((user) => {
                return user.username;
            });
        }
    }
    /**
     * Gets an appropriate token for the given URL. If `portal` is ArcGIS Online and
     * the request is to an ArcGIS Online domain `token` will be used. If the request
     * is to the current `portal` the current `token` will also be used. However if
     * the request is to an unknown server we will validate the server with a request
     * to our current `portal`.
     */
    getToken(url, requestOptions) {
        if ((0, federation_utils_js_1.canUseOnlineToken)(this.portal, url)) {
            return this.getFreshToken(requestOptions);
        }
        else if (new RegExp(this.portal, "i").test(url)) {
            return this.getFreshToken(requestOptions);
        }
        else {
            return this.getTokenForServer(url, requestOptions);
        }
    }
    /**
     * Get application access information for the current user
     * see `validateAppAccess` function for details
     *
     * @param clientId application client id
     */
    validateAppAccess(clientId) {
        return this.getToken(this.portal).then((token) => {
            return (0, validate_app_access_js_1.validateAppAccess)(token, clientId);
        });
    }
    toJSON() {
        return {
            clientId: this.clientId,
            refreshToken: this.refreshToken,
            refreshTokenExpires: this.refreshTokenExpires || undefined,
            username: this.username,
            password: this.password,
            token: this.token,
            tokenExpires: this.tokenExpires || undefined,
            portal: this.portal,
            ssl: this.ssl,
            tokenDuration: this.tokenDuration,
            redirectUri: this.redirectUri,
            server: this.server
        };
    }
    serialize() {
        return JSON.stringify(this);
    }
    /**
     * For a "Host" app that embeds other platform apps via iframes, after authenticating the user
     * and creating a ArcGISIdentityManager, the app can then enable "post message" style authentication by calling
     * this method.
     *
     * Internally this adds an event listener on window for the `message` event
     *
     * @param validChildOrigins Array of origins that are allowed to request authentication from the host app
     */
    enablePostMessageAuth(validChildOrigins, win) {
        /* istanbul ignore next: must pass in a mockwindow for tests so we can't cover the other branch */
        if (!win && window) {
            win = window;
        }
        this._hostHandler = this.createPostMessageHandler(validChildOrigins);
        win.addEventListener("message", this._hostHandler, false);
    }
    /**
     * For a "Host" app that has embedded other platform apps via iframes, when the host needs
     * to transition routes, it should call `ArcGISIdentityManager.disablePostMessageAuth()` to remove
     * the event listener and prevent memory leaks
     */
    disablePostMessageAuth(win) {
        /* istanbul ignore next: must pass in a mockwindow for tests so we can't cover the other branch */
        if (!win && window) {
            win = window;
        }
        win.removeEventListener("message", this._hostHandler, false);
    }
    /**
     * Manually refreshes the current `token` and `tokenExpires`.
     */
    refreshCredentials(requestOptions) {
        // make sure subsequent calls to getUser() don't returned cached metadata
        this._user = null;
        if (this.username && this.password) {
            return this.refreshWithUsernameAndPassword(requestOptions);
        }
        if (this.clientId && this.refreshToken) {
            return this.refreshWithRefreshToken();
        }
        return Promise.reject(new ArcGISTokenRequestError_js_1.ArcGISTokenRequestError("Unable to refresh token. No refresh token or password present.", ArcGISTokenRequestError_js_1.ArcGISTokenRequestErrorCodes.TOKEN_REFRESH_FAILED));
    }
    /**
     * Determines the root of the ArcGIS Server or Portal for a given URL.
     *
     * @param url the URl to determine the root url for.
     */
    getServerRootUrl(url) {
        const [root] = (0, clean_url_js_1.cleanUrl)(url).split(/\/rest(\/admin)?\/services(?:\/|#|\?|$)/);
        const [match, protocol, domainAndPath] = root.match(/(https?:\/\/)(.+)/);
        const [domain, ...path] = domainAndPath.split("/");
        // only the domain is lowercased because in some cases an org id might be
        // in the path which cannot be lowercased.
        return `${protocol}${domain.toLowerCase()}/${path.join("/")}`;
    }
    /**
     * Returns the proper [`credentials`] option for `fetch` for a given domain.
     * See [trusted server](https://enterprise.arcgis.com/en/portal/latest/administer/windows/configure-security.htm#ESRI_SECTION1_70CC159B3540440AB325BE5D89DBE94A).
     * Used internally by underlying request methods to add support for specific security considerations.
     *
     * @param url The url of the request
     * @returns "include" or "same-origin"
     */
    getDomainCredentials(url) {
        if (!this.trustedDomains || !this.trustedDomains.length) {
            return "same-origin";
        }
        return this.trustedDomains.some((domainWithProtocol) => {
            return url.startsWith(domainWithProtocol);
        })
            ? "include"
            : "same-origin";
    }
    /**
     * Convenience method for {@linkcode ArcGISIdentityManager.destroy} for this instance of `ArcGISIdentityManager`
     */
    signOut() {
        return ArcGISIdentityManager.destroy(this);
    }
    /**
     * Return a function that closes over the validOrigins array and
     * can be used as an event handler for the `message` event
     *
     * @param validOrigins Array of valid origins
     */
    createPostMessageHandler(validOrigins) {
        // return a function that closes over the validOrigins and
        // has access to the credential
        return (event) => {
            // Verify that the origin is valid
            // Note: do not use regex's here. validOrigins is an array so we're checking that the event's origin
            // is in the array via exact match. More info about avoiding postMessage xss issues here
            // https://jlajara.gitlab.io/web/2020/07/17/Dom_XSS_PostMessage_2.html#tipsbypasses-in-postmessage-vulnerabilities
            const isValidOrigin = validOrigins.indexOf(event.origin) > -1;
            // JSAPI handles this slightly differently - instead of checking a list, it will respond if
            // event.origin === window.location.origin || event.origin.endsWith('.arcgis.com')
            // For Hub, and to enable cross domain debugging with port's in urls, we are opting to
            // use a list of valid origins
            // Ensure the message type is something we want to handle
            const isValidType = event.data.type === "arcgis:auth:requestCredential";
            // Ensure we don't pass an expired session forward
            const isTokenValid = this.tokenExpires.getTime() > Date.now();
            if (isValidOrigin && isValidType) {
                let msg = {};
                if (isTokenValid) {
                    const credential = this.toJSON();
                    msg = {
                        type: "arcgis:auth:credential",
                        credential
                    };
                }
                else {
                    msg = {
                        type: "arcgis:auth:error",
                        error: {
                            name: "tokenExpiredError",
                            message: "Token was expired, and not returned to the child application"
                        }
                    };
                }
                event.source.postMessage(msg, event.origin);
            }
        };
    }
    /**
     * Validates that a given URL is properly federated with our current `portal`.
     * Attempts to use the internal `federatedServers` cache first.
     */
    getTokenForServer(url, requestOptions) {
        // requests to /rest/services/ and /rest/admin/services/ are both valid
        // Federated servers may have inconsistent casing, so lowerCase it
        const root = this.getServerRootUrl(url);
        const existingToken = this.federatedServers[root];
        if (existingToken &&
            existingToken.expires &&
            existingToken.expires.getTime() > Date.now()) {
            return Promise.resolve(existingToken.token);
        }
        if (this._pendingTokenRequests[root]) {
            return this._pendingTokenRequests[root];
        }
        this._pendingTokenRequests[root] = this.fetchAuthorizedDomains().then(() => {
            return (0, request_js_1.request)(`${root}/rest/info`, {
                credentials: this.getDomainCredentials(url)
            })
                .then((serverInfo) => {
                if (serverInfo.owningSystemUrl) {
                    /**
                     * if this server is not owned by this portal
                     * bail out with an error since we know we wont
                     * be able to generate a token
                     */
                    if (!(0, federation_utils_js_1.isFederated)(serverInfo.owningSystemUrl, this.portal)) {
                        throw new ArcGISTokenRequestError_js_1.ArcGISTokenRequestError(`${url} is not federated with ${this.portal}.`, ArcGISTokenRequestError_js_1.ArcGISTokenRequestErrorCodes.NOT_FEDERATED);
                    }
                    else {
                        /**
                         * if the server is federated, use the relevant token endpoint.
                         */
                        return (0, request_js_1.request)(`${serverInfo.owningSystemUrl}/sharing/rest/info`, requestOptions);
                    }
                }
                else if (serverInfo.authInfo &&
                    this.federatedServers[root] !== undefined) {
                    /**
                     * if its a stand-alone instance of ArcGIS Server that doesn't advertise
                     * federation, but the root server url is recognized, use its built in token endpoint.
                     */
                    return Promise.resolve({
                        authInfo: serverInfo.authInfo
                    });
                }
                else {
                    throw new ArcGISTokenRequestError_js_1.ArcGISTokenRequestError(`${url} is not federated with any portal and is not explicitly trusted.`, ArcGISTokenRequestError_js_1.ArcGISTokenRequestErrorCodes.NOT_FEDERATED);
                }
            })
                .then((serverInfo) => {
                // an expired token cant be used to generate a new token so refresh our credentials before trying to generate a server token
                if (this.token && this.tokenExpires.getTime() < Date.now()) {
                    // If we are authenticated to a single server just refresh with username and password and use the new credentials as the credentials for this server.
                    if (this.server) {
                        return this.refreshCredentials().then(() => {
                            return {
                                token: this.token,
                                expires: this.tokenExpires
                            };
                        });
                    }
                    // Otherwise refresh the credentials for the portal and generate a URL for the specific server.
                    return this.refreshCredentials().then(() => {
                        return this.generateTokenForServer(serverInfo.authInfo.tokenServicesUrl, root);
                    });
                }
                else {
                    return this.generateTokenForServer(serverInfo.authInfo.tokenServicesUrl, root);
                }
            })
                .then((response) => {
                this.federatedServers[root] = response;
                delete this._pendingTokenRequests[root];
                return response.token;
            });
        });
        return this._pendingTokenRequests[root];
    }
    /**
     * Generates a token for a given `serverUrl` using a given `tokenServicesUrl`.
     */
    generateTokenForServer(tokenServicesUrl, serverUrl) {
        return (0, request_js_1.request)(tokenServicesUrl, {
            params: {
                token: this.token,
                serverUrl,
                expiration: this.tokenDuration
            }
        })
            .then((response) => {
            return {
                token: response.token,
                expires: new Date(response.expires - 1000 * 60 * 5)
            };
        })
            .catch((e) => {
            throw new ArcGISTokenRequestError_js_1.ArcGISTokenRequestError(e.message, ArcGISTokenRequestError_js_1.ArcGISTokenRequestErrorCodes.GENERATE_TOKEN_FOR_SERVER_FAILED, e.response, e.url, e.options);
        });
    }
    /**
     * Returns an unexpired token for the current `portal`.
     */
    getFreshToken(requestOptions) {
        if (this.token && !this.tokenExpires) {
            return Promise.resolve(this.token);
        }
        if (this.token &&
            this.tokenExpires &&
            this.tokenExpires.getTime() > Date.now()) {
            return Promise.resolve(this.token);
        }
        if (!this._pendingTokenRequests[this.portal]) {
            this._pendingTokenRequests[this.portal] = this.refreshCredentials(requestOptions).then(() => {
                this._pendingTokenRequests[this.portal] = null;
                return this.token;
            });
        }
        return this._pendingTokenRequests[this.portal];
    }
    /**
     * Refreshes the current `token` and `tokenExpires` with `username` and
     * `password`.
     */
    refreshWithUsernameAndPassword(requestOptions) {
        const params = {
            username: this.username,
            password: this.password,
            expiration: this.tokenDuration,
            client: "referer",
            referer: typeof window !== "undefined" &&
                typeof window.document !== "undefined" &&
                window.location &&
                window.location.origin
                ? window.location.origin
                : /* istanbul ignore next */
                    index_js_1.NODEJS_DEFAULT_REFERER_HEADER
        };
        return (this.server
            ? (0, request_js_1.request)(`${this.getServerRootUrl(this.server)}/rest/info`).then((response) => {
                return (0, request_js_1.request)(response.authInfo.tokenServicesUrl, Object.assign({ params }, requestOptions));
            })
            : (0, request_js_1.request)(`${this.portal}/generateToken`, Object.assign({ params }, requestOptions)))
            .then((response) => {
            this.updateToken(response.token, new Date(response.expires));
            return this;
        })
            .catch((e) => {
            throw new ArcGISTokenRequestError_js_1.ArcGISTokenRequestError(e.message, ArcGISTokenRequestError_js_1.ArcGISTokenRequestErrorCodes.TOKEN_REFRESH_FAILED, e.response, e.url, e.options);
        });
    }
    /**
     * Refreshes the current `token` and `tokenExpires` with `refreshToken`.
     */
    refreshWithRefreshToken(requestOptions) {
        // If our refresh token expires sometime in the next 24 hours then refresh the refresh token
        const ONE_DAY_IN_MILLISECONDS = 1000 * 60 * 60 * 24;
        if (this.refreshToken &&
            this.refreshTokenExpires &&
            this.refreshTokenExpires.getTime() - ONE_DAY_IN_MILLISECONDS < Date.now()) {
            return this.exchangeRefreshToken(requestOptions);
        }
        const options = Object.assign({ params: {
                client_id: this.clientId,
                refresh_token: this.refreshToken,
                grant_type: "refresh_token"
            } }, requestOptions);
        return (0, fetch_token_js_1.fetchToken)(`${this.portal}/oauth2/token`, options)
            .then((response) => {
            return this.updateToken(response.token, response.expires);
        })
            .catch((e) => {
            throw new ArcGISTokenRequestError_js_1.ArcGISTokenRequestError(e.message, ArcGISTokenRequestError_js_1.ArcGISTokenRequestErrorCodes.TOKEN_REFRESH_FAILED, e.response, e.url, e.options);
        });
    }
    /**
     * Update the stored {@linkcode ArcGISIdentityManager.token} and {@linkcode ArcGISIdentityManager.tokenExpires} properties. This method is used internally when refreshing tokens.
     * You may need to call this if you want update the token with a new token from an external source.
     *
     * @param newToken The new token to use for this instance of `ArcGISIdentityManager`.
     * @param newTokenExpiration The new expiration date of the token.
     * @returns
     */
    updateToken(newToken, newTokenExpiration) {
        this._token = newToken;
        this._tokenExpires = newTokenExpiration;
        return this;
    }
    /**
     * Exchanges an unexpired `refreshToken` for a new one, also updates `token` and
     * `tokenExpires`.
     */
    exchangeRefreshToken(requestOptions) {
        const options = Object.assign({ params: {
                client_id: this.clientId,
                refresh_token: this.refreshToken,
                redirect_uri: this.redirectUri,
                grant_type: "exchange_refresh_token"
            } }, requestOptions);
        return (0, fetch_token_js_1.fetchToken)(`${this.portal}/oauth2/token`, options)
            .then((response) => {
            this._token = response.token;
            this._tokenExpires = response.expires;
            this._refreshToken = response.refreshToken;
            this._refreshTokenExpires = response.refreshTokenExpires;
            return this;
        })
            .catch((e) => {
            throw new ArcGISTokenRequestError_js_1.ArcGISTokenRequestError(e.message, ArcGISTokenRequestError_js_1.ArcGISTokenRequestErrorCodes.REFRESH_TOKEN_EXCHANGE_FAILED, e.response, e.url, e.options);
        });
    }
    /**
     * ensures that the authorizedCrossOriginDomains are obtained from the portal and cached
     * so we can check them later.
     *
     * @returns this
     */
    fetchAuthorizedDomains() {
        // if this token is for a specific server or we don't have a portal
        // don't get the portal info because we cant get the authorizedCrossOriginDomains
        if (this.server || !this.portal) {
            return Promise.resolve(this);
        }
        return this.getPortal().then((portalInfo) => {
            /**
             * Specific domains can be configured as secure.esri.com or https://secure.esri.com this
             * normalizes to https://secure.esri.com so we can use startsWith later.
             */
            if (portalInfo.authorizedCrossOriginDomains &&
                portalInfo.authorizedCrossOriginDomains.length) {
                this.trustedDomains = portalInfo.authorizedCrossOriginDomains
                    .filter((d) => !d.startsWith("http://"))
                    .map((d) => {
                    if (d.startsWith("https://")) {
                        return d;
                    }
                    else {
                        return `https://${d}`;
                    }
                });
            }
            return this;
        });
    }
}
exports.ArcGISIdentityManager = ArcGISIdentityManager;
/**
 * @deprecated - Use {@linkcode ArcGISIdentityManager}.
 * @internal
 *
 */ /* istanbul ignore next */
function UserSession(options) {
    console.log("DEPRECATED:, 'UserSession' is deprecated. Use 'ArcGISIdentityManager' instead.");
    return new ArcGISIdentityManager(options);
}
exports.UserSession = UserSession;
/**
 * @deprecated - Use {@linkcode ArcGISIdentityManager.beginOAuth2}.
 * @internal
 *
 */ /* istanbul ignore next */
UserSession.beginOAuth2 = function (...args) {
    console.warn("DEPRECATED:, 'UserSession.beginOAuth2' is deprecated. Use 'ArcGISIdentityManager.beginOAuth2' instead.");
    return ArcGISIdentityManager.beginOAuth2(...args);
};
/**
 * @deprecated - Use {@linkcode ArcGISIdentityManager.completeOAuth2}.
 * @internal
 *
 */ /* istanbul ignore next */
UserSession.completeOAuth2 = function (...args) {
    console.warn("DEPRECATED:, 'UserSession.completeOAuth2()' is deprecated. Use 'ArcGISIdentityManager.completeOAuth2()' instead.");
    if (args.length <= 1) {
        console.warn("WARNING:, 'UserSession.completeOAuth2()' is now async and returns a promise the resolves to an instance of `ArcGISIdentityManager`.");
    }
    return ArcGISIdentityManager.completeOAuth2(...args);
};
/**
 * @deprecated - Use {@linkcode ArcGISIdentityManager.fromParent}.
 * @internal
 *
 */ /* istanbul ignore next */
UserSession.fromParent = function (...args) {
    console.warn("DEPRECATED:, 'UserSession.fromParent' is deprecated. Use 'ArcGISIdentityManager.fromParent' instead.");
    return ArcGISIdentityManager.fromParent(...args);
};
/**
 * @deprecated - Use {@linkcode ArcGISIdentityManager.authorize}.
 * @internal
 *
 */ /* istanbul ignore next */
UserSession.authorize = function (...args) {
    console.warn("DEPRECATED:, 'UserSession.authorize' is deprecated. Use 'ArcGISIdentityManager.authorize' instead.");
    return ArcGISIdentityManager.authorize(...args);
};
/**
 * @deprecated - Use {@linkcode ArcGISIdentityManager.exchangeAuthorizationCode}.
 * @internal
 *
 */ /* istanbul ignore next */
UserSession.exchangeAuthorizationCode = function (...args) {
    console.warn("DEPRECATED:, 'UserSession.exchangeAuthorizationCode' is deprecated. Use 'ArcGISIdentityManager.exchangeAuthorizationCode' instead.");
    return ArcGISIdentityManager.exchangeAuthorizationCode(...args);
};
/**
 * @deprecated - Use {@linkcode ArcGISIdentityManager.fromCredential}.
 * @internal
 *
 */ /* istanbul ignore next */
UserSession.fromCredential = function (...args) {
    console.log("DEPRECATED:, 'UserSession.fromCredential' is deprecated. Use 'ArcGISIdentityManager.fromCredential' instead.");
    console.warn("WARNING:, 'UserSession.fromCredential' now requires a `ServerInfo` object from the JS API as a second parameter.");
    return ArcGISIdentityManager.fromCredential(...args);
};
/**
 * @deprecated - Use {@linkcode ArcGISIdentityManager.deserialize}.
 * @internal
 *
 */ /* istanbul ignore next */
UserSession.deserialize = function (...args) {
    console.log("DEPRECATED:, 'UserSession.deserialize' is deprecated. Use 'ArcGISIdentityManager.deserialize' instead.");
    return ArcGISIdentityManager.deserialize(...args);
};
//# sourceMappingURL=ArcGISIdentityManager.js.map