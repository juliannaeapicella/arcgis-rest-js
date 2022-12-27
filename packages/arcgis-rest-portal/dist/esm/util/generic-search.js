/* Copyright (c) 2018 Environmental Systems Research Institute, Inc.
 * Apache-2.0 */
import { request, appendCustomParams } from "@esri/arcgis-rest-request";
import { SearchQueryBuilder } from "./SearchQueryBuilder.js";
import { getPortalUrl } from "../util/get-portal-url.js";
export function genericSearch(search, searchType) {
    let options;
    if (typeof search === "string" || search instanceof SearchQueryBuilder) {
        options = {
            httpMethod: "GET",
            params: {
                q: search
            }
        };
    }
    else {
        // searchUserAccess has one (known) valid value: "groupMember"
        options = appendCustomParams(search, [
            "q",
            "num",
            "start",
            "sortField",
            "sortOrder",
            "searchUserAccess",
            "searchUserName",
            "filter",
            "countFields",
            "countSize",
            "categories",
            "categoryFilters"
        ], {
            httpMethod: "GET"
        });
    }
    let path;
    switch (searchType) {
        case "item":
            path = "/search";
            break;
        case "group":
            path = "/community/groups";
            break;
        case "groupContent":
            // Need to have groupId property to do group contents search,
            // cso filter out all but ISearchGroupContentOptions
            if (typeof search !== "string" &&
                !(search instanceof SearchQueryBuilder) &&
                search.groupId) {
                path = `/content/groups/${search.groupId}/search`;
            }
            else {
                return Promise.reject(new Error("you must pass a `groupId` option to `searchGroupContent`"));
            }
            break;
        default:
            // "users"
            path = "/portals/self/users/search";
            break;
    }
    const url = getPortalUrl(options) + path;
    // send the request
    return request(url, options).then((r) => {
        if (r.nextStart && r.nextStart !== -1) {
            r.nextPage = function () {
                let newOptions;
                if (typeof search === "string" ||
                    search instanceof SearchQueryBuilder) {
                    newOptions = {
                        q: search,
                        start: r.nextStart
                    };
                }
                else {
                    newOptions = search;
                    newOptions.start = r.nextStart;
                }
                return genericSearch(newOptions, searchType);
            };
        }
        return r;
    });
}
//# sourceMappingURL=generic-search.js.map