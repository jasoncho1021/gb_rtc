/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./public/coi-serviceworker.js":
/*!*************************************!*\
  !*** ./public/coi-serviceworker.js ***!
  \*************************************/
/***/ (() => {

eval("/*! coi-serviceworker v0.1.6 - Guido Zuidhof, licensed under MIT */\nlet coepCredentialless = false;\nif (typeof window === 'undefined') {\n    self.addEventListener(\"install\", () => self.skipWaiting());\n    self.addEventListener(\"activate\", (event) => event.waitUntil(self.clients.claim()));\n\n    self.addEventListener(\"message\", (ev) => {\n        if (!ev.data) {\n            return;\n        } else if (ev.data.type === \"deregister\") {\n            self.registration\n                .unregister()\n                .then(() => {\n                    return self.clients.matchAll();\n                })\n                .then(clients => {\n                    clients.forEach((client) => client.navigate(client.url));\n                });\n        } else if (ev.data.type === \"coepCredentialless\") {\n            coepCredentialless = ev.data.value;\n        }\n    });\n\n    self.addEventListener(\"fetch\", function (event) {\n        const r = event.request;\n        if (r.cache === \"only-if-cached\" && r.mode !== \"same-origin\") {\n            return;\n        }\n\n        const request = (coepCredentialless && r.mode === \"no-cors\")\n            ? new Request(r, {\n                credentials: \"omit\",\n            })\n            : r;\n        event.respondWith(\n            fetch(request)\n                .then((response) => {\n                    if (response.status === 0) {\n                        return response;\n                    }\n\n                    const newHeaders = new Headers(response.headers);\n                    newHeaders.set(\"Cross-Origin-Embedder-Policy\",\n                        coepCredentialless ? \"credentialless\" : \"require-corp\"\n                    );\n                    newHeaders.set(\"Cross-Origin-Opener-Policy\", \"same-origin\");\n\n                    return new Response(response.body, {\n                        status: response.status,\n                        statusText: response.statusText,\n                        headers: newHeaders,\n                    });\n                })\n                .catch((e) => console.error(e))\n        );\n    });\n\n} else {\n    (() => {\n        // You can customize the behavior of this script through a global `coi` variable.\n        const coi = {\n            shouldRegister: () => true,\n            shouldDeregister: () => false,\n            coepCredentialless: () => false,\n            doReload: () => window.location.reload(),\n            quiet: false,\n            ...window.coi\n        };\n\n        const n = navigator;\n\n        if (n.serviceWorker && n.serviceWorker.controller) {\n            n.serviceWorker.controller.postMessage({\n                type: \"coepCredentialless\",\n                value: coi.coepCredentialless(),\n            });\n\n            if (coi.shouldDeregister()) {\n                n.serviceWorker.controller.postMessage({ type: \"deregister\" });\n            }\n        }\n\n        // If we're already coi: do nothing. Perhaps it's due to this script doing its job, or COOP/COEP are\n        // already set from the origin server. Also if the browser has no notion of crossOriginIsolated, just give up here.\n        if (window.crossOriginIsolated !== false || !coi.shouldRegister()) return;\n\n        if (!window.isSecureContext) {\n            !coi.quiet && console.log(\"COOP/COEP Service Worker not registered, a secure context is required.\");\n            return;\n        }\n\n        // In some environments (e.g. Chrome incognito mode) this won't be available\n        if (n.serviceWorker) {\n            n.serviceWorker.register(window.document.currentScript.src).then(\n                (registration) => {\n                    !coi.quiet && console.log(\"COOP/COEP Service Worker registered\", registration.scope);\n\n                    registration.addEventListener(\"updatefound\", () => {\n                        !coi.quiet && console.log(\"Reloading page to make use of updated COOP/COEP Service Worker.\");\n                        coi.doReload();\n                    });\n\n                    // If the registration is active, but it's not controlling the page\n                    if (registration.active && !n.serviceWorker.controller) {\n                        !coi.quiet && console.log(\"Reloading page to make use of COOP/COEP Service Worker.\");\n                        coi.doReload();\n                    }\n                },\n                (err) => {\n                    !coi.quiet && console.error(\"COOP/COEP Service Worker failed to register:\", err);\n                }\n            );\n        }\n    })();\n}\n\n\n//# sourceURL=webpack://dmg_rtc_par_pattern/./public/coi-serviceworker.js?");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module can't be inlined because the eval devtool is used.
/******/ 	var __webpack_exports__ = {};
/******/ 	__webpack_modules__["./public/coi-serviceworker.js"]();
/******/ 	
/******/ })()
;