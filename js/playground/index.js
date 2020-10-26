define(["require", "exports", "./createElements", "./sidebar/runtime", "./exporter", "./createUI", "./getExample", "./monaco/ExampleHighlight", "./createConfigDropdown", "./sidebar/plugins", "./pluginUtils", "./sidebar/settings"], function (require, exports, createElements_1, runtime_1, exporter_1, createUI_1, getExample_1, ExampleHighlight_1, createConfigDropdown_1, plugins_1, pluginUtils_1, settings_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.setupPlayground = void 0;
    exports.setupPlayground = (sandbox, monaco, config, i, react) => {
        const playgroundParent = sandbox.getDomNode().parentElement.parentElement.parentElement;
        const dragBar = createElements_1.createDragBar();
        playgroundParent.appendChild(dragBar);
        const sidebar = createElements_1.createSidebar();
        playgroundParent.appendChild(sidebar);
        const tabBar = createElements_1.createTabBar();
        sidebar.appendChild(tabBar);
        const container = createElements_1.createPluginContainer();
        sidebar.appendChild(container);
        const plugins = [];
        const tabs = [];
        // Let's things like the workbench hook into tab changes
        let didUpdateTab;
        const registerPlugin = (plugin) => {
            plugins.push(plugin);
            const tab = createElements_1.createTabForPlugin(plugin);
            tabs.push(tab);
            const tabClicked = e => {
                const previousPlugin = getCurrentPlugin();
                let newTab = e.target;
                // It could be a notification you clicked on
                if (newTab.tagName === "DIV")
                    newTab = newTab.parentElement;
                const newPlugin = plugins.find(p => `playground-plugin-tab-${p.id}` == newTab.id);
                createElements_1.activatePlugin(newPlugin, previousPlugin, sandbox, tabBar, container);
                didUpdateTab && didUpdateTab(newPlugin, previousPlugin);
            };
            tabBar.appendChild(tab);
            tab.onclick = tabClicked;
        };
        const setDidUpdateTab = (func) => {
            didUpdateTab = func;
        };
        const getCurrentPlugin = () => {
            const selectedTab = tabs.find(t => t.classList.contains("active"));
            return plugins[tabs.indexOf(selectedTab)];
        };
        const defaultPlugins = config.plugins || settings_1.getPlaygroundPlugins();
        const utils = pluginUtils_1.createUtils(sandbox, react);
        const initialPlugins = defaultPlugins.map(f => f(i, utils));
        initialPlugins.forEach(p => registerPlugin(p));
        // Choose which should be selected
        const priorityPlugin = plugins.find(plugin => plugin.shouldBeSelected && plugin.shouldBeSelected());
        const selectedPlugin = priorityPlugin || plugins[0];
        const selectedTab = tabs[plugins.indexOf(selectedPlugin)];
        selectedTab.onclick({ target: selectedTab });
        let debouncingTimer = false;
        sandbox.editor.onDidChangeModelContent(_event => {
            const plugin = getCurrentPlugin();
            if (plugin.modelChanged)
                plugin.modelChanged(sandbox, sandbox.getModel(), container);
            // This needs to be last in the function
            if (debouncingTimer)
                return;
            debouncingTimer = true;
            setTimeout(() => {
                debouncingTimer = false;
                playgroundDebouncedMainFunction();
                // Only call the plugin function once every 0.3s
                if (plugin.modelChangedDebounce && plugin.id === getCurrentPlugin().id) {
                    plugin.modelChangedDebounce(sandbox, sandbox.getModel(), container);
                }
            }, 300);
        });
        // If you set this to true, then the next time the playground would
        // have set the user's hash it would be skipped - used for setting
        // the text in examples
        let suppressNextTextChangeForHashChange = false;
        // Sets the URL and storage of the sandbox string
        const playgroundDebouncedMainFunction = () => {
            const alwaysUpdateURL = !localStorage.getItem("disable-save-on-type");
            if (alwaysUpdateURL) {
                if (suppressNextTextChangeForHashChange) {
                    suppressNextTextChangeForHashChange = false;
                    return;
                }
                const newURL = sandbox.createURLQueryWithCompilerOptions(sandbox);
                window.history.replaceState({}, "", newURL);
            }
            localStorage.setItem("sandbox-history", sandbox.getText());
        };
        // When any compiler flags are changed, trigger a potential change to the URL
        sandbox.setDidUpdateCompilerSettings(() => {
            playgroundDebouncedMainFunction();
            // @ts-ignore
            window.appInsights.trackEvent({ name: "Compiler Settings changed" });
            const model = sandbox.editor.getModel();
            const plugin = getCurrentPlugin();
            if (model && plugin.modelChanged)
                plugin.modelChanged(sandbox, model, container);
            if (model && plugin.modelChangedDebounce)
                plugin.modelChangedDebounce(sandbox, model, container);
        });
        const skipInitiallySettingHash = document.location.hash && document.location.hash.includes("example/");
        if (!skipInitiallySettingHash)
            playgroundDebouncedMainFunction();
        // Setup working with the existing UI, once it's loaded
        // Versions of TypeScript
        // Set up the label for the dropdown
        const versionButton = document.querySelectorAll("#versions > a").item(0);
        versionButton.innerHTML = "v" + sandbox.ts.version + " <span class='caret'/>";
        versionButton.setAttribute("aria-label", `Select version of TypeScript, currently ${sandbox.ts.version}`);
        // Add the versions to the dropdown
        const versionsMenu = document.querySelectorAll("#versions > ul").item(0);
        // Enable all submenus
        document.querySelectorAll("nav ul li").forEach(e => e.classList.add("active"));
        const notWorkingInPlayground = ["3.1.6", "3.0.1", "2.8.1", "2.7.2", "2.4.1"];
        const allVersions = [...sandbox.supportedVersions.filter(f => !notWorkingInPlayground.includes(f)), "Nightly"];
        allVersions.forEach((v) => {
            const li = document.createElement("li");
            const a = document.createElement("a");
            a.textContent = v;
            a.href = "#";
            if (v === "Nightly") {
                li.classList.add("nightly");
            }
            if (v.toLowerCase().includes("beta")) {
                li.classList.add("beta");
            }
            li.onclick = () => {
                const currentURL = sandbox.createURLQueryWithCompilerOptions(sandbox);
                const params = new URLSearchParams(currentURL.split("#")[0]);
                const version = v === "Nightly" ? "next" : v;
                params.set("ts", version);
                const hash = document.location.hash.length ? document.location.hash : "";
                const newURL = `${document.location.protocol}//${document.location.host}${document.location.pathname}?${params}${hash}`;
                // @ts-ignore - it is allowed
                document.location = newURL;
            };
            li.appendChild(a);
            versionsMenu.appendChild(li);
        });
        // Support dropdowns
        document.querySelectorAll(".navbar-sub li.dropdown > a").forEach(link => {
            const a = link;
            a.onclick = _e => {
                if (a.parentElement.classList.contains("open")) {
                    document.querySelectorAll(".navbar-sub li.open").forEach(i => i.classList.remove("open"));
                    a.setAttribute("aria-expanded", "false");
                }
                else {
                    document.querySelectorAll(".navbar-sub li.open").forEach(i => i.classList.remove("open"));
                    a.parentElement.classList.toggle("open");
                    a.setAttribute("aria-expanded", "true");
                    const exampleContainer = a.closest("li").getElementsByTagName("ul").item(0);
                    const firstLabel = exampleContainer.querySelector("label");
                    if (firstLabel)
                        firstLabel.focus();
                    // Set exact height and widths for the popovers for the main playground navigation
                    const isPlaygroundSubmenu = !!a.closest("nav");
                    if (isPlaygroundSubmenu) {
                        const playgroundContainer = document.getElementById("playground-container");
                        exampleContainer.style.height = `calc(${playgroundContainer.getBoundingClientRect().height + 26}px - 4rem)`;
                        const sideBarWidth = document.querySelector(".playground-sidebar").offsetWidth;
                        exampleContainer.style.width = `calc(100% - ${sideBarWidth}px - 71px)`;
                        // All this is to make sure that tabbing stays inside the dropdown for tsconfig/examples
                        const buttons = exampleContainer.querySelectorAll("input");
                        const lastButton = buttons.item(buttons.length - 1);
                        if (lastButton) {
                            redirectTabPressTo(lastButton, exampleContainer, ".examples-close");
                        }
                        else {
                            const sections = document.querySelectorAll("ul.examples-dropdown .section-content");
                            sections.forEach(s => {
                                const buttons = s.querySelectorAll("a.example-link");
                                const lastButton = buttons.item(buttons.length - 1);
                                if (lastButton) {
                                    redirectTabPressTo(lastButton, exampleContainer, ".examples-close");
                                }
                            });
                        }
                    }
                }
                return false;
            };
        });
        // Handle escape closing dropdowns etc
        document.onkeydown = function (evt) {
            evt = evt || window.event;
            var isEscape = false;
            if ("key" in evt) {
                isEscape = evt.key === "Escape" || evt.key === "Esc";
            }
            else {
                // @ts-ignore - this used to be the case
                isEscape = evt.keyCode === 27;
            }
            if (isEscape) {
                document.querySelectorAll(".navbar-sub li.open").forEach(i => i.classList.remove("open"));
                document.querySelectorAll(".navbar-sub li").forEach(i => i.setAttribute("aria-expanded", "false"));
            }
        };
        const shareAction = {
            id: "copy-clipboard",
            label: "Save to clipboard",
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_S],
            contextMenuGroupId: "run",
            contextMenuOrder: 1.5,
            run: function () {
                window.navigator.clipboard.writeText(location.href.toString()).then(() => ui.flashInfo(i("play_export_clipboard")), (e) => alert(e));
            },
        };
        const shareButton = document.getElementById("share-button");
        if (shareButton) {
            shareButton.onclick = e => {
                e.preventDefault();
                shareAction.run();
                return false;
            };
            // Set up some key commands
            sandbox.editor.addAction(shareAction);
            sandbox.editor.addAction({
                id: "run-js",
                label: "Run the evaluated JavaScript for your TypeScript file",
                keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
                contextMenuGroupId: "run",
                contextMenuOrder: 1.5,
                run: function (ed) {
                    const runButton = document.getElementById("run-button");
                    runButton && runButton.onclick && runButton.onclick({});
                },
            });
        }
        const runButton = document.getElementById("run-button");
        if (runButton) {
            runButton.onclick = () => {
                const run = sandbox.getRunnableJS();
                const runPlugin = plugins.find(p => p.id === "logs");
                createElements_1.activatePlugin(runPlugin, getCurrentPlugin(), sandbox, tabBar, container);
                runtime_1.runWithCustomLogs(run, i);
                const isJS = sandbox.config.useJavaScript;
                ui.flashInfo(i(isJS ? "play_run_js" : "play_run_ts"));
                return false;
            };
        }
        // Handle the close buttons on the examples
        document.querySelectorAll("button.examples-close").forEach(b => {
            const button = b;
            button.onclick = (e) => {
                const button = e.target;
                const navLI = button.closest("li");
                navLI === null || navLI === void 0 ? void 0 : navLI.classList.remove("open");
            };
        });
        createElements_1.setupSidebarToggle();
        if (document.getElementById("config-container")) {
            createConfigDropdown_1.createConfigDropdown(sandbox, monaco);
            createConfigDropdown_1.updateConfigDropdownForCompilerOptions(sandbox, monaco);
        }
        if (document.getElementById("playground-settings")) {
            const settingsToggle = document.getElementById("playground-settings");
            settingsToggle.onclick = () => {
                const open = settingsToggle.parentElement.classList.contains("open");
                const sidebarTabs = document.querySelector(".playground-plugin-tabview");
                const sidebarContent = document.querySelector(".playground-plugin-container");
                let settingsContent = document.querySelector(".playground-settings-container");
                if (!settingsContent) {
                    settingsContent = document.createElement("div");
                    settingsContent.className = "playground-settings-container playground-plugin-container";
                    const settings = settings_1.settingsPlugin(i, utils);
                    settings.didMount && settings.didMount(sandbox, settingsContent);
                    document.querySelector(".playground-sidebar").appendChild(settingsContent);
                    // When the last tab item is hit, go back to the settings button
                    const labels = document.querySelectorAll(".playground-sidebar input");
                    const lastLabel = labels.item(labels.length - 1);
                    if (lastLabel) {
                        redirectTabPressTo(lastLabel, undefined, "#playground-settings");
                    }
                }
                if (open) {
                    sidebarTabs.style.display = "flex";
                    sidebarContent.style.display = "block";
                    settingsContent.style.display = "none";
                }
                else {
                    sidebarTabs.style.display = "none";
                    sidebarContent.style.display = "none";
                    settingsContent.style.display = "block";
                    document.querySelector(".playground-sidebar label").focus();
                }
                settingsToggle.parentElement.classList.toggle("open");
            };
            settingsToggle.addEventListener("keydown", e => {
                const isOpen = settingsToggle.parentElement.classList.contains("open");
                if (e.keyCode === 9 && isOpen) {
                    const result = document.querySelector(".playground-options li input");
                    result.focus();
                    e.preventDefault();
                }
            });
        }
        // Support grabbing examples from the location hash
        if (location.hash.startsWith("#example")) {
            const exampleName = location.hash.replace("#example/", "").trim();
            sandbox.config.logger.log("Loading example:", exampleName);
            getExample_1.getExampleSourceCode(config.prefix, config.lang, exampleName).then(ex => {
                if (ex.example && ex.code) {
                    const { example, code } = ex;
                    // Update the localstorage showing that you've seen this page
                    if (localStorage) {
                        const seenText = localStorage.getItem("examples-seen") || "{}";
                        const seen = JSON.parse(seenText);
                        seen[example.id] = example.hash;
                        localStorage.setItem("examples-seen", JSON.stringify(seen));
                    }
                    const allLinks = document.querySelectorAll("example-link");
                    // @ts-ignore
                    for (const link of allLinks) {
                        if (link.textContent === example.title) {
                            link.classList.add("highlight");
                        }
                    }
                    document.title = "TypeScript Playground - " + example.title;
                    suppressNextTextChangeForHashChange = true;
                    sandbox.setText(code);
                }
                else {
                    suppressNextTextChangeForHashChange = true;
                    sandbox.setText("// There was an issue getting the example, bad URL? Check the console in the developer tools");
                }
            });
        }
        // This isn't optimal, but it's good enough without me adding support
        // for https://github.com/microsoft/monaco-editor/issues/313
        setInterval(() => {
            const markers = sandbox.monaco.editor.getModelMarkers({});
            utils.setNotifications("errors", markers.length);
        }, 500);
        // Sets up a way to click between examples
        monaco.languages.registerLinkProvider(sandbox.language, new ExampleHighlight_1.ExampleHighlighter());
        const languageSelector = document.getElementById("language-selector");
        if (languageSelector) {
            const params = new URLSearchParams(location.search);
            languageSelector.options.selectedIndex = params.get("useJavaScript") ? 1 : 0;
            languageSelector.onchange = () => {
                const useJavaScript = languageSelector.value === "JavaScript";
                const query = sandbox.createURLQueryWithCompilerOptions(sandbox, {
                    useJavaScript: useJavaScript ? true : undefined,
                });
                const fullURL = `${document.location.protocol}//${document.location.host}${document.location.pathname}${query}`;
                // @ts-ignore
                document.location = fullURL;
            };
        }
        // Ensure that the editor is full-width when the screen resizes
        window.addEventListener("resize", () => {
            sandbox.editor.layout();
        });
        const ui = createUI_1.createUI();
        const exporter = exporter_1.createExporter(sandbox, monaco, ui);
        const playground = {
            exporter,
            ui,
            registerPlugin,
            plugins,
            getCurrentPlugin,
            tabs,
            setDidUpdateTab,
            createUtils: pluginUtils_1.createUtils,
        };
        window.ts = sandbox.ts;
        window.sandbox = sandbox;
        window.playground = playground;
        console.log(`Using TypeScript ${window.ts.version}`);
        console.log("Available globals:");
        console.log("\twindow.ts", window.ts);
        console.log("\twindow.sandbox", window.sandbox);
        console.log("\twindow.playground", window.playground);
        console.log("\twindow.react", window.react);
        console.log("\twindow.reactDOM", window.reactDOM);
        /** A plugin */
        const activateExternalPlugin = (plugin, autoActivate) => {
            let readyPlugin;
            // Can either be a factory, or object
            if (typeof plugin === "function") {
                const utils = pluginUtils_1.createUtils(sandbox, react);
                readyPlugin = plugin(utils);
            }
            else {
                readyPlugin = plugin;
            }
            if (autoActivate) {
                console.log(readyPlugin);
            }
            playground.registerPlugin(readyPlugin);
            // Auto-select the dev plugin
            const pluginWantsFront = readyPlugin.shouldBeSelected && readyPlugin.shouldBeSelected();
            if (pluginWantsFront || autoActivate) {
                // Auto-select the dev plugin
                createElements_1.activatePlugin(readyPlugin, getCurrentPlugin(), sandbox, tabBar, container);
            }
        };
        // Dev mode plugin
        if (config.supportCustomPlugins && plugins_1.allowConnectingToLocalhost()) {
            window.exports = {};
            console.log("Connecting to dev plugin");
            try {
                // @ts-ignore
                const re = window.require;
                re(["local/index"], (devPlugin) => {
                    console.log("Set up dev plugin from localhost:5000");
                    try {
                        activateExternalPlugin(devPlugin, true);
                    }
                    catch (error) {
                        console.error(error);
                        setTimeout(() => {
                            ui.flashInfo("Error: Could not load dev plugin from localhost:5000");
                        }, 700);
                    }
                });
            }
            catch (error) {
                console.error("Problem loading up the dev plugin");
                console.error(error);
            }
        }
        const downloadPlugin = (plugin, autoEnable) => {
            try {
                // @ts-ignore
                const re = window.require;
                re([`unpkg/${plugin}@latest/dist/index`], (devPlugin) => {
                    activateExternalPlugin(devPlugin, autoEnable);
                });
            }
            catch (error) {
                console.error("Problem loading up the plugin:", plugin);
                console.error(error);
            }
        };
        if (config.supportCustomPlugins) {
            // Grab ones from localstorage
            plugins_1.activePlugins().forEach(p => downloadPlugin(p.id, false));
            // Offer to install one if 'install-plugin' is a query param
            const params = new URLSearchParams(location.search);
            const pluginToInstall = params.get("install-plugin");
            if (pluginToInstall) {
                const alreadyInstalled = plugins_1.activePlugins().find(p => p.id === pluginToInstall);
                if (!alreadyInstalled) {
                    const shouldDoIt = confirm("Would you like to install the third party plugin?\n\n" + pluginToInstall);
                    if (shouldDoIt) {
                        plugins_1.addCustomPlugin(pluginToInstall);
                        downloadPlugin(pluginToInstall, true);
                    }
                }
            }
        }
        if (location.hash.startsWith("#show-examples")) {
            setTimeout(() => {
                var _a;
                (_a = document.getElementById("examples-button")) === null || _a === void 0 ? void 0 : _a.click();
            }, 100);
        }
        if (location.hash.startsWith("#show-whatisnew")) {
            setTimeout(() => {
                var _a;
                (_a = document.getElementById("whatisnew-button")) === null || _a === void 0 ? void 0 : _a.click();
            }, 100);
        }
        return playground;
    };
    const redirectTabPressTo = (element, container, query) => {
        element.addEventListener("keydown", e => {
            if (e.keyCode === 9) {
                const host = container || document;
                const result = host.querySelector(query);
                if (!result)
                    throw new Error(`Expected to find a result for keydown`);
                result.focus();
                e.preventDefault();
            }
        });
    };
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9wbGF5Z3JvdW5kL3NyYy9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7O0lBc0VhLFFBQUEsZUFBZSxHQUFHLENBQzdCLE9BQWdCLEVBQ2hCLE1BQWMsRUFDZCxNQUF3QixFQUN4QixDQUEwQixFQUMxQixLQUFtQixFQUNuQixFQUFFO1FBQ0YsTUFBTSxnQkFBZ0IsR0FBRyxPQUFPLENBQUMsVUFBVSxFQUFFLENBQUMsYUFBYyxDQUFDLGFBQWMsQ0FBQyxhQUFjLENBQUE7UUFDMUYsTUFBTSxPQUFPLEdBQUcsOEJBQWEsRUFBRSxDQUFBO1FBQy9CLGdCQUFnQixDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQTtRQUVyQyxNQUFNLE9BQU8sR0FBRyw4QkFBYSxFQUFFLENBQUE7UUFDL0IsZ0JBQWdCLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFBO1FBRXJDLE1BQU0sTUFBTSxHQUFHLDZCQUFZLEVBQUUsQ0FBQTtRQUM3QixPQUFPLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFBO1FBRTNCLE1BQU0sU0FBUyxHQUFHLHNDQUFxQixFQUFFLENBQUE7UUFDekMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQTtRQUU5QixNQUFNLE9BQU8sR0FBRyxFQUF3QixDQUFBO1FBQ3hDLE1BQU0sSUFBSSxHQUFHLEVBQXlCLENBQUE7UUFFdEMsd0RBQXdEO1FBQ3hELElBQUksWUFBaUcsQ0FBQTtRQUVyRyxNQUFNLGNBQWMsR0FBRyxDQUFDLE1BQXdCLEVBQUUsRUFBRTtZQUNsRCxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFBO1lBRXBCLE1BQU0sR0FBRyxHQUFHLG1DQUFrQixDQUFDLE1BQU0sQ0FBQyxDQUFBO1lBRXRDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUE7WUFFZCxNQUFNLFVBQVUsR0FBMkIs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QUEsUUFBUSxDQUFDLGNBQWMsQ0FBQyxpQkFBaUIsQ0FBQywwQ0FBRSxLQUFLLEdBQUU7WUFDckQsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFBO1NBQ1I7UUFFRCxJQUFJLFFBQVEsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLGlCQUFpQixDQUFDLEVBQUU7WUFDL0MsVUFBVSxDQUFDLEdBQUcsRUFBRTs7Z0JBQ2QsTUFBQSxRQUFRLENBQUMsY0FBYyxDQUFDLGtCQUFrQixDQUFDLDBDQUFFLEtBQUssR0FBRTtZQUN0RCxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUE7U0FDUjtRQUVELE9BQU8sVUFBVSxDQUFBO0lBQ25CLENBQUMsQ0FBQTtJQUlELE1BQU0sa0JBQWtCLEdBQUcsQ0FBQyxPQUFvQixFQUFFLFNBQWtDLEVBQUUsS0FBYSxFQUFFLEVBQUU7UUFDckcsT0FBTyxDQUFDLGdCQUFnQixDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsRUFBRTtZQUN0QyxJQUFJLENBQUMsQ0FBQyxPQUFPLEtBQUssQ0FBQyxFQUFFO2dCQUNuQixNQUFNLElBQUksR0FBRyxTQUFTLElBQUksUUFBUSxDQUFBO2dCQUNsQyxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBUSxDQUFBO2dCQUMvQyxJQUFJLENBQUMsTUFBTTtvQkFBRSxNQUFNLElBQUksS0FBSyxDQUFDLHVDQUF1QyxDQUFDLENBQUE7Z0JBQ3JFLE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQTtnQkFDZCxDQUFDLENBQUMsY0FBYyxFQUFFLENBQUE7YUFDbkI7UUFDSCxDQUFDLENBQUMsQ0FBQTtJQUNKLENBQUMsQ0FBQSIsInNvdXJjZXNDb250ZW50IjpbInR5cGUgU2FuZGJveCA9IGltcG9ydChcInR5cGVzY3JpcHQtc2FuZGJveFwiKS5TYW5kYm94XG50eXBlIE1vbmFjbyA9IHR5cGVvZiBpbXBvcnQoXCJtb25hY28tZWRpdG9yXCIpXG5cbmRlY2xhcmUgY29uc3Qgd2luZG93OiBhbnlcblxuaW1wb3J0IHtcbiAgY3JlYXRlU2lkZWJhcixcbiAgY3JlYXRlVGFiRm9yUGx1Z2luLFxuICBjcmVhdGVUYWJCYXIsXG4gIGNyZWF0ZVBsdWdpbkNvbnRhaW5lcixcbiAgYWN0aXZhdGVQbHVnaW4sXG4gIGNyZWF0ZURyYWdCYXIsXG4gIHNldHVwU2lkZWJhclRvZ2dsZSxcbn0gZnJvbSBcIi4vY3JlYXRlRWxlbWVudHNcIlxuaW1wb3J0IHsgcnVuV2l0aEN1c3RvbUxvZ3MgfSBmcm9tIFwiLi9zaWRlYmFyL3J1bnRpbWVcIlxuaW1wb3J0IHsgY3JlYXRlRXhwb3J0ZXIgfSBmcm9tIFwiLi9leHBvcnRlclwiXG5pbXBvcnQgeyBjcmVhdGVVSSB9IGZyb20gXCIuL2NyZWF0ZVVJXCJcbmltcG9ydCB7IGdldEV4YW1wbGVTb3VyY2VDb2RlIH0gZnJvbSBcIi4vZ2V0RXhhbXBsZVwiXG5pbXBvcnQgeyBFeGFtcGxlSGlnaGxpZ2h0ZXIgfSBmcm9tIFwiLi9tb25hY28vRXhhbXBsZUhpZ2hsaWdodFwiXG5pbXBvcnQgeyBjcmVhdGVDb25maWdEcm9wZG93biwgdXBkYXRlQ29uZmlnRHJvcGRvd25Gb3JDb21waWxlck9wdGlvbnMgfSBmcm9tIFwiLi9jcmVhdGVDb25maWdEcm9wZG93blwiXG5pbXBvcnQgeyBhbGxvd0Nvbm5lY3RpbmdUb0xvY2FsaG9zdCwgYWN0aXZlUGx1Z2lucywgYWRkQ3VzdG9tUGx1Z2luIH0gZnJvbSBcIi4vc2lkZWJhci9wbHVnaW5zXCJcbmltcG9ydCB7IGNyZWF0ZVV0aWxzLCBQbHVnaW5VdGlscyB9IGZyb20gXCIuL3BsdWdpblV0aWxzXCJcbmltcG9ydCB0eXBlIFJlYWN0IGZyb20gXCJyZWFjdFwiXG5pbXBvcnQgeyBzZXR0aW5nc1BsdWdpbiwgZ2V0UGxheWdyb3VuZFBsdWdpbnMgfSBmcm9tIFwiLi9zaWRlYmFyL3NldHRpbmdzXCJcblxuZXhwb3J0IHsgUGx1Z2luVXRpbHMgfSBmcm9tIFwiLi9wbHVnaW5VdGlsc1wiXG5cbmV4cG9ydCB0eXBlIFBsdWdpbkZhY3RvcnkgPSB7XG4gIChpOiAoa2V5OiBzdHJpbmcsIGNvbXBvbmVudHM/OiBhbnkpID0+IHN0cmluZywgdXRpbHM6IFBsdWdpblV0aWxzKTogUGxheWdyb3VuZFBsdWdpblxufVxuXG4vKiogVGhlIGludGVyZmFjZSBvZiBhbGwgc2lkZWJhciBwbHVnaW5zICovXG5leHBvcnQgaW50ZXJmYWNlIFBsYXlncm91bmRQbHVnaW4ge1xuICAvKiogTm90IHB1YmxpYyBmYWNpbmcsIGJ1dCB1c2VkIGJ5IHRoZSBwbGF5Z3JvdW5kIHRvIHVuaXF1ZWx5IGlkZW50aWZ5IHBsdWdpbnMgKi9cbiAgaWQ6IHN0cmluZ1xuICAvKiogVG8gc2hvdyBpbiB0aGUgdGFicyAqL1xuICBkaXNwbGF5TmFtZTogc3RyaW5nXG4gIC8qKiBTaG91bGQgdGhpcyBwbHVnaW4gYmUgc2VsZWN0ZWQgd2hlbiB0aGUgcGx1Z2luIGlzIGZpcnN0IGxvYWRlZD8gTGV0cyB5b3UgY2hlY2sgZm9yIHF1ZXJ5IHZhcnMgZXRjIHRvIGxvYWQgYSBwYXJ0aWN1bGFyIHBsdWdpbiAqL1xuICBzaG91bGRCZVNlbGVjdGVkPzogKCkgPT4gYm9vbGVhblxuICAvKiogQmVmb3JlIHdlIHNob3cgdGhlIHRhYiwgdXNlIHRoaXMgdG8gc2V0IHVwIHlvdXIgSFRNTCAtIGl0IHdpbGwgYWxsIGJlIHJlbW92ZWQgYnkgdGhlIHBsYXlncm91bmQgd2hlbiBzb21lb25lIG5hdmlnYXRlcyBvZmYgdGhlIHRhYiAqL1xuICB3aWxsTW91bnQ/OiAoc2FuZGJveDogU2FuZGJveCwgY29udGFpbmVyOiBIVE1MRGl2RWxlbWVudCkgPT4gdm9pZFxuICAvKiogQWZ0ZXIgd2Ugc2hvdyB0aGUgdGFiICovXG4gIGRpZE1vdW50PzogKHNhbmRib3g6IFNhbmRib3gsIGNvbnRhaW5lcjogSFRNTERpdkVsZW1lbnQpID0+IHZvaWRcbiAgLyoqIE1vZGVsIGNoYW5nZXMgd2hpbGUgdGhpcyBwbHVnaW4gaXMgYWN0aXZlbHkgc2VsZWN0ZWQgICovXG4gIG1vZGVsQ2hhbmdlZD86IChzYW5kYm94OiBTYW5kYm94LCBtb2RlbDogaW1wb3J0KFwibW9uYWNvLWVkaXRvclwiKS5lZGl0b3IuSVRleHRNb2RlbCwgY29udGFpbmVyOiBIVE1MRGl2RWxlbWVudCkgPT4gdm9pZFxuICAvKiogRGVsYXllZCBtb2RlbCBjaGFuZ2VzIHdoaWxlIHRoaXMgcGx1Z2luIGlzIGFjdGl2ZWx5IHNlbGVjdGVkLCB1c2VmdWwgd2hlbiB5b3UgYXJlIHdvcmtpbmcgd2l0aCB0aGUgVFMgQVBJIGJlY2F1c2UgaXQgd29uJ3QgcnVuIG9uIGV2ZXJ5IGtleXByZXNzICovXG4gIG1vZGVsQ2hhbmdlZERlYm91bmNlPzogKFxuICAgIHNhbmRib3g6IFNhbmRib3gsXG4gICAgbW9kZWw6IGltcG9ydChcIm1vbmFjby1lZGl0b3JcIikuZWRpdG9yLklUZXh0TW9kZWwsXG4gICAgY29udGFpbmVyOiBIVE1MRGl2RWxlbWVudFxuICApID0+IHZvaWRcbiAgLyoqIEJlZm9yZSB3ZSByZW1vdmUgdGhlIHRhYiAqL1xuICB3aWxsVW5tb3VudD86IChzYW5kYm94OiBTYW5kYm94LCBjb250YWluZXI6IEhUTUxEaXZFbGVtZW50KSA9PiB2b2lkXG4gIC8qKiBBZnRlciB3ZSByZW1vdmUgdGhlIHRhYiAqL1xuICBkaWRVbm1vdW50PzogKHNhbmRib3g6IFNhbmRib3gsIGNvbnRhaW5lcjogSFRNTERpdkVsZW1lbnQpID0+IHZvaWRcbiAgLyoqIEFuIG9iamVjdCB5b3UgY2FuIHVzZSB0byBrZWVwIGRhdGEgYXJvdW5kIGluIHRoZSBzY29wZSBvZiB5b3VyIHBsdWdpbiBvYmplY3QgKi9cbiAgZGF0YT86IGFueVxufVxuXG5pbnRlcmZhY2UgUGxheWdyb3VuZENvbmZpZyB7XG4gIC8qKiBMYW5ndWFnZSBsaWtlIFwiZW5cIiAvIFwiamFcIiBldGMgKi9cbiAgbGFuZzogc3RyaW5nXG4gIC8qKiBTaXRlIHByZWZpeCwgbGlrZSBcInYyXCIgZHVyaW5nIHRoZSBwcmUtcmVsZWFzZSAqL1xuICBwcmVmaXg6IHN0cmluZ1xuICAvKiogT3B0aW9uYWwgcGx1Z2lucyBzbyB0aGF0IHdlIGNhbiByZS11c2UgdGhlIHBsYXlncm91bmQgd2l0aCBkaWZmZXJlbnQgc2lkZWJhcnMgKi9cbiAgcGx1Z2lucz86IFBsdWdpbkZhY3RvcnlbXVxuICAvKiogU2hvdWxkIHRoaXMgcGxheWdyb3VuZCBsb2FkIHVwIGN1c3RvbSBwbHVnaW5zIGZyb20gbG9jYWxTdG9yYWdlPyAqL1xuICBzdXBwb3J0Q3VzdG9tUGx1Z2luczogYm9vbGVhblxufVxuXG5leHBvcnQgY29uc3Qgc2V0dXBQbGF5Z3JvdW5kID0gKFxuICBzYW5kYm94OiBTYW5kYm94LFxuICBtb25hY286IE1vbmFjbyxcbiAgY29uZmlnOiBQbGF5Z3JvdW5kQ29uZmlnLFxuICBpOiAoa2V5OiBzdHJpbmcpID0+IHN0cmluZyxcbiAgcmVhY3Q6IHR5cGVvZiBSZWFjdFxuKSA9PiB7XG4gIGNvbnN0IHBsYXlncm91bmRQYXJlbnQgPSBzYW5kYm94LmdldERvbU5vZGUoKS5wYXJlbnRFbGVtZW50IS5wYXJlbnRFbGVtZW50IS5wYXJlbnRFbGVtZW50IVxuICBjb25zdCBkcmFnQmFyID0gY3JlYXRlRHJhZ0JhcigpXG4gIHBsYXlncm91bmRQYXJlbnQuYXBwZW5kQ2hpbGQoZHJhZ0JhcilcblxuICBjb25zdCBzaWRlYmFyID0gY3JlYXRlU2lkZWJhcigpXG4gIHBsYXlncm91bmRQYXJlbnQuYXBwZW5kQ2hpbGQoc2lkZWJhcilcblxuICBjb25zdCB0YWJCYXIgPSBjcmVhdGVUYWJCYXIoKVxuICBzaWRlYmFyLmFwcGVuZENoaWxkKHRhYkJhcilcblxuICBjb25zdCBjb250YWluZXIgPSBjcmVhdGVQbHVnaW5Db250YWluZXIoKVxuICBzaWRlYmFyLmFwcGVuZENoaWxkKGNvbnRhaW5lcilcblxuICBjb25zdCBwbHVnaW5zID0gW10gYXMgUGxheWdyb3VuZFBsdWdpbltdXG4gIGNvbnN0IHRhYnMgPSBbXSBhcyBIVE1MQnV0dG9uRWxlbWVudFtdXG5cbiAgLy8gTGV0J3MgdGhpbmdzIGxpa2UgdGhlIHdvcmtiZW5jaCBob29rIGludG8gdGFiIGNoYW5nZXNcbiAgbGV0IGRpZFVwZGF0ZVRhYjogKG5ld1BsdWdpbjogUGxheWdyb3VuZFBsdWdpbiwgcHJldmlvdXNQbHVnaW46IFBsYXlncm91bmRQbHVnaW4pID0+IHZvaWQgfCB1bmRlZmluZWRcblxuICBjb25zdCByZWdpc3RlclBsdWdpbiA9IChwbHVnaW46IFBsYXlncm91bmRQbHVnaW4pID0+IHtcbiAgICBwbHVnaW5zLnB1c2gocGx1Z2luKVxuXG4gICAgY29uc3QgdGFiID0gY3JlYXRlVGFiRm9yUGx1Z2luKHBsdWdpbilcblxuICAgIHRhYnMucHVzaCh0YWIpXG5cbiAgICBjb25zdCB0YWJDbGlja2VkOiBIVE1MRWxlbWVudFtcIm9uY2xpY2tcIl0gPSBlID0+IHtcbiAgICAgIGNvbnN0IHByZXZpb3VzUGx1Z2luID0gZ2V0Q3VycmVudFBsdWdpbigpXG4gICAgICBsZXQgbmV3VGFiID0gZS50YXJnZXQgYXMgSFRNTEVsZW1lbnRcbiAgICAgIC8vIEl0IGNvdWxkIGJlIGEgbm90aWZpY2F0aW9uIHlvdSBjbGlja2VkIG9uXG4gICAgICBpZiAobmV3VGFiLnRhZ05hbWUgPT09IFwiRElWXCIpIG5ld1RhYiA9IG5ld1RhYi5wYXJlbnRFbGVtZW50IVxuICAgICAgY29uc3QgbmV3UGx1Z2luID0gcGx1Z2lucy5maW5kKHAgPT4gYHBsYXlncm91bmQtcGx1Z2luLXRhYi0ke3AuaWR9YCA9PSBuZXdUYWIuaWQpIVxuICAgICAgYWN0aXZhdGVQbHVnaW4obmV3UGx1Z2luLCBwcmV2aW91c1BsdWdpbiwgc2FuZGJveCwgdGFiQmFyLCBjb250YWluZXIpXG4gICAgICBkaWRVcGRhdGVUYWIgJiYgZGlkVXBkYXRlVGFiKG5ld1BsdWdpbiwgcHJldmlvdXNQbHVnaW4pXG4gICAgfVxuXG4gICAgdGFiQmFyLmFwcGVuZENoaWxkKHRhYilcbiAgICB0YWIub25jbGljayA9IHRhYkNsaWNrZWRcbiAgfVxuXG4gIGNvbnN0IHNldERpZFVwZGF0ZVRhYiA9IChmdW5jOiAobmV3UGx1Z2luOiBQbGF5Z3JvdW5kUGx1Z2luLCBwcmV2aW91c1BsdWdpbjogUGxheWdyb3VuZFBsdWdpbikgPT4gdm9pZCkgPT4ge1xuICAgIGRpZFVwZGF0ZVRhYiA9IGZ1bmNcbiAgfVxuXG4gIGNvbnN0IGdldEN1cnJlbnRQbHVnaW4gPSAoKSA9PiB7XG4gICAgY29uc3Qgc2VsZWN0ZWRUYWIgPSB0YWJzLmZpbmQodCA9PiB0LmNsYXNzTGlzdC5jb250YWlucyhcImFjdGl2ZVwiKSkhXG4gICAgcmV0dXJuIHBsdWdpbnNbdGFicy5pbmRleE9mKHNlbGVjdGVkVGFiKV1cbiAgfVxuXG4gIGNvbnN0IGRlZmF1bHRQbHVnaW5zID0gY29uZmlnLnBsdWdpbnMgfHwgZ2V0UGxheWdyb3VuZFBsdWdpbnMoKVxuICBjb25zdCB1dGlscyA9IGNyZWF0ZVV0aWxzKHNhbmRib3gsIHJlYWN0KVxuICBjb25zdCBpbml0aWFsUGx1Z2lucyA9IGRlZmF1bHRQbHVnaW5zLm1hcChmID0+IGYoaSwgdXRpbHMpKVxuICBpbml0aWFsUGx1Z2lucy5mb3JFYWNoKHAgPT4gcmVnaXN0ZXJQbHVnaW4ocCkpXG5cbiAgLy8gQ2hvb3NlIHdoaWNoIHNob3VsZCBiZSBzZWxlY3RlZFxuICBjb25zdCBwcmlvcml0eVBsdWdpbiA9IHBsdWdpbnMuZmluZChwbHVnaW4gPT4gcGx1Z2luLnNob3VsZEJlU2VsZWN0ZWQgJiYgcGx1Z2luLnNob3VsZEJlU2VsZWN0ZWQoKSlcbiAgY29uc3Qgc2VsZWN0ZWRQbHVnaW4gPSBwcmlvcml0eVBsdWdpbiB8fCBwbHVnaW5zWzBdXG4gIGNvbnN0IHNlbGVjdGVkVGFiID0gdGFic1twbHVnaW5zLmluZGV4T2Yoc2VsZWN0ZWRQbHVnaW4pXSFcbiAgc2VsZWN0ZWRUYWIub25jbGljayEoeyB0YXJnZXQ6IHNlbGVjdGVkVGFiIH0gYXMgYW55KVxuXG4gIGxldCBkZWJvdW5jaW5nVGltZXIgPSBmYWxzZVxuICBzYW5kYm94LmVkaXRvci5vbkRpZENoYW5nZU1vZGVsQ29udGVudChfZXZlbnQgPT4ge1xuICAgIGNvbnN0IHBsdWdpbiA9IGdldEN1cnJlbnRQbHVnaW4oKVxuICAgIGlmIChwbHVnaW4ubW9kZWxDaGFuZ2VkKSBwbHVnaW4ubW9kZWxDaGFuZ2VkKHNhbmRib3gsIHNhbmRib3guZ2V0TW9kZWwoKSwgY29udGFpbmVyKVxuXG4gICAgLy8gVGhpcyBuZWVkcyB0byBiZSBsYXN0IGluIHRoZSBmdW5jdGlvblxuICAgIGlmIChkZWJvdW5jaW5nVGltZXIpIHJldHVyblxuICAgIGRlYm91bmNpbmdUaW1lciA9IHRydWVcbiAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIGRlYm91bmNpbmdUaW1lciA9IGZhbHNlXG4gICAgICBwbGF5Z3JvdW5kRGVib3VuY2VkTWFpbkZ1bmN0aW9uKClcblxuICAgICAgLy8gT25seSBjYWxsIHRoZSBwbHVnaW4gZnVuY3Rpb24gb25jZSBldmVyeSAwLjNzXG4gICAgICBpZiAocGx1Z2luLm1vZGVsQ2hhbmdlZERlYm91bmNlICYmIHBsdWdpbi5pZCA9PT0gZ2V0Q3VycmVudFBsdWdpbigpLmlkKSB7XG4gICAgICAgIHBsdWdpbi5tb2RlbENoYW5nZWREZWJvdW5jZShzYW5kYm94LCBzYW5kYm94LmdldE1vZGVsKCksIGNvbnRhaW5lcilcbiAgICAgIH1cbiAgICB9LCAzMDApXG4gIH0pXG5cbiAgLy8gSWYgeW91IHNldCB0aGlzIHRvIHRydWUsIHRoZW4gdGhlIG5leHQgdGltZSB0aGUgcGxheWdyb3VuZCB3b3VsZFxuICAvLyBoYXZlIHNldCB0aGUgdXNlcidzIGhhc2ggaXQgd291bGQgYmUgc2tpcHBlZCAtIHVzZWQgZm9yIHNldHRpbmdcbiAgLy8gdGhlIHRleHQgaW4gZXhhbXBsZXNcbiAgbGV0IHN1cHByZXNzTmV4dFRleHRDaGFuZ2VGb3JIYXNoQ2hhbmdlID0gZmFsc2VcblxuICAvLyBTZXRzIHRoZSBVUkwgYW5kIHN0b3JhZ2Ugb2YgdGhlIHNhbmRib3ggc3RyaW5nXG4gIGNvbnN0IHBsYXlncm91bmREZWJvdW5jZWRNYWluRnVuY3Rpb24gPSAoKSA9PiB7XG4gICAgY29uc3QgYWx3YXlzVXBkYXRlVVJMID0gIWxvY2FsU3RvcmFnZS5nZXRJdGVtKFwiZGlzYWJsZS1zYXZlLW9uLXR5cGVcIilcbiAgICBpZiAoYWx3YXlzVXBkYXRlVVJMKSB7XG4gICAgICBpZiAoc3VwcHJlc3NOZXh0VGV4dENoYW5nZUZvckhhc2hDaGFuZ2UpIHtcbiAgICAgICAgc3VwcHJlc3NOZXh0VGV4dENoYW5nZUZvckhhc2hDaGFuZ2UgPSBmYWxzZVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cbiAgICAgIGNvbnN0IG5ld1VSTCA9IHNhbmRib3guY3JlYXRlVVJMUXVlcnlXaXRoQ29tcGlsZXJPcHRpb25zKHNhbmRib3gpXG4gICAgICB3aW5kb3cuaGlzdG9yeS5yZXBsYWNlU3RhdGUoe30sIFwiXCIsIG5ld1VSTClcbiAgICB9XG5cbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbShcInNhbmRib3gtaGlzdG9yeVwiLCBzYW5kYm94LmdldFRleHQoKSlcbiAgfVxuXG4gIC8vIFdoZW4gYW55IGNvbXBpbGVyIGZsYWdzIGFyZSBjaGFuZ2VkLCB0cmlnZ2VyIGEgcG90ZW50aWFsIGNoYW5nZSB0byB0aGUgVVJMXG4gIHNhbmRib3guc2V0RGlkVXBkYXRlQ29tcGlsZXJTZXR0aW5ncygoKSA9PiB7XG4gICAgcGxheWdyb3VuZERlYm91bmNlZE1haW5GdW5jdGlvbigpXG4gICAgLy8gQHRzLWlnbm9yZVxuICAgIHdpbmRvdy5hcHBJbnNpZ2h0cy50cmFja0V2ZW50KHsgbmFtZTogXCJDb21waWxlciBTZXR0aW5ncyBjaGFuZ2VkXCIgfSlcblxuICAgIGNvbnN0IG1vZGVsID0gc2FuZGJveC5lZGl0b3IuZ2V0TW9kZWwoKVxuICAgIGNvbnN0IHBsdWdpbiA9IGdldEN1cnJlbnRQbHVnaW4oKVxuICAgIGlmIChtb2RlbCAmJiBwbHVnaW4ubW9kZWxDaGFuZ2VkKSBwbHVnaW4ubW9kZWxDaGFuZ2VkKHNhbmRib3gsIG1vZGVsLCBjb250YWluZXIpXG4gICAgaWYgKG1vZGVsICYmIHBsdWdpbi5tb2RlbENoYW5nZWREZWJvdW5jZSkgcGx1Z2luLm1vZGVsQ2hhbmdlZERlYm91bmNlKHNhbmRib3gsIG1vZGVsLCBjb250YWluZXIpXG4gIH0pXG5cbiAgY29uc3Qgc2tpcEluaXRpYWxseVNldHRpbmdIYXNoID0gZG9jdW1lbnQubG9jYXRpb24uaGFzaCAmJiBkb2N1bWVudC5sb2NhdGlvbi5oYXNoLmluY2x1ZGVzKFwiZXhhbXBsZS9cIilcbiAgaWYgKCFza2lwSW5pdGlhbGx5U2V0dGluZ0hhc2gpIHBsYXlncm91bmREZWJvdW5jZWRNYWluRnVuY3Rpb24oKVxuXG4gIC8vIFNldHVwIHdvcmtpbmcgd2l0aCB0aGUgZXhpc3RpbmcgVUksIG9uY2UgaXQncyBsb2FkZWRcblxuICAvLyBWZXJzaW9ucyBvZiBUeXBlU2NyaXB0XG5cbiAgLy8gU2V0IHVwIHRoZSBsYWJlbCBmb3IgdGhlIGRyb3Bkb3duXG4gIGNvbnN0IHZlcnNpb25CdXR0b24gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiI3ZlcnNpb25zID4gYVwiKS5pdGVtKDApXG4gIHZlcnNpb25CdXR0b24uaW5uZXJIVE1MID0gXCJ2XCIgKyBzYW5kYm94LnRzLnZlcnNpb24gKyBcIiA8c3BhbiBjbGFzcz0nY2FyZXQnLz5cIlxuICB2ZXJzaW9uQnV0dG9uLnNldEF0dHJpYnV0ZShcImFyaWEtbGFiZWxcIiwgYFNlbGVjdCB2ZXJzaW9uIG9mIFR5cGVTY3JpcHQsIGN1cnJlbnRseSAke3NhbmRib3gudHMudmVyc2lvbn1gKVxuXG4gIC8vIEFkZCB0aGUgdmVyc2lvbnMgdG8gdGhlIGRyb3Bkb3duXG4gIGNvbnN0IHZlcnNpb25zTWVudSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCIjdmVyc2lvbnMgPiB1bFwiKS5pdGVtKDApXG5cbiAgLy8gRW5hYmxlIGFsbCBzdWJtZW51c1xuICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwibmF2IHVsIGxpXCIpLmZvckVhY2goZSA9PiBlLmNsYXNzTGlzdC5hZGQoXCJhY3RpdmVcIikpXG5cbiAgY29uc3Qgbm90V29ya2luZ0luUGxheWdyb3VuZCA9IFtcIjMuMS42XCIsIFwiMy4wLjFcIiwgXCIyLjguMVwiLCBcIjIuNy4yXCIsIFwiMi40LjFcIl1cblxuICBjb25zdCBhbGxWZXJzaW9ucyA9IFsuLi5zYW5kYm94LnN1cHBvcnRlZFZlcnNpb25zLmZpbHRlcihmID0+ICFub3RXb3JraW5nSW5QbGF5Z3JvdW5kLmluY2x1ZGVzKGYpKSwgXCJOaWdodGx5XCJdXG5cbiAgYWxsVmVyc2lvbnMuZm9yRWFjaCgodjogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgbGkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwibGlcIilcbiAgICBjb25zdCBhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImFcIilcbiAgICBhLnRleHRDb250ZW50ID0gdlxuICAgIGEuaHJlZiA9IFwiI1wiXG5cbiAgICBpZiAodiA9PT0gXCJOaWdodGx5XCIpIHtcbiAgICAgIGxpLmNsYXNzTGlzdC5hZGQoXCJuaWdodGx5XCIpXG4gICAgfVxuXG4gICAgaWYgKHYudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhcImJldGFcIikpIHtcbiAgICAgIGxpLmNsYXNzTGlzdC5hZGQoXCJiZXRhXCIpXG4gICAgfVxuXG4gICAgbGkub25jbGljayA9ICgpID0+IHtcbiAgICAgIGNvbnN0IGN1cnJlbnRVUkwgPSBzYW5kYm94LmNyZWF0ZVVSTFF1ZXJ5V2l0aENvbXBpbGVyT3B0aW9ucyhzYW5kYm94KVxuICAgICAgY29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcyhjdXJyZW50VVJMLnNwbGl0KFwiI1wiKVswXSlcbiAgICAgIGNvbnN0IHZlcnNpb24gPSB2ID09PSBcIk5pZ2h0bHlcIiA/IFwibmV4dFwiIDogdlxuICAgICAgcGFyYW1zLnNldChcInRzXCIsIHZlcnNpb24pXG5cbiAgICAgIGNvbnN0IGhhc2ggPSBkb2N1bWVudC5sb2NhdGlvbi5oYXNoLmxlbmd0aCA/IGRvY3VtZW50LmxvY2F0aW9uLmhhc2ggOiBcIlwiXG4gICAgICBjb25zdCBuZXdVUkwgPSBgJHtkb2N1bWVudC5sb2NhdGlvbi5wcm90b2NvbH0vLyR7ZG9jdW1lbnQubG9jYXRpb24uaG9zdH0ke2RvY3VtZW50LmxvY2F0aW9uLnBhdGhuYW1lfT8ke3BhcmFtc30ke2hhc2h9YFxuXG4gICAgICAvLyBAdHMtaWdub3JlIC0gaXQgaXMgYWxsb3dlZFxuICAgICAgZG9jdW1lbnQubG9jYXRpb24gPSBuZXdVUkxcbiAgICB9XG5cbiAgICBsaS5hcHBlbmRDaGlsZChhKVxuICAgIHZlcnNpb25zTWVudS5hcHBlbmRDaGlsZChsaSlcbiAgfSlcblxuICAvLyBTdXBwb3J0IGRyb3Bkb3duc1xuICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiLm5hdmJhci1zdWIgbGkuZHJvcGRvd24gPiBhXCIpLmZvckVhY2gobGluayA9PiB7XG4gICAgY29uc3QgYSA9IGxpbmsgYXMgSFRNTEFuY2hvckVsZW1lbnRcbiAgICBhLm9uY2xpY2sgPSBfZSA9PiB7XG4gICAgICBpZiAoYS5wYXJlbnRFbGVtZW50IS5jbGFzc0xpc3QuY29udGFpbnMoXCJvcGVuXCIpKSB7XG4gICAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCIubmF2YmFyLXN1YiBsaS5vcGVuXCIpLmZvckVhY2goaSA9PiBpLmNsYXNzTGlzdC5yZW1vdmUoXCJvcGVuXCIpKVxuICAgICAgICBhLnNldEF0dHJpYnV0ZShcImFyaWEtZXhwYW5kZWRcIiwgXCJmYWxzZVwiKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcIi5uYXZiYXItc3ViIGxpLm9wZW5cIikuZm9yRWFjaChpID0+IGkuY2xhc3NMaXN0LnJlbW92ZShcIm9wZW5cIikpXG4gICAgICAgIGEucGFyZW50RWxlbWVudCEuY2xhc3NMaXN0LnRvZ2dsZShcIm9wZW5cIilcbiAgICAgICAgYS5zZXRBdHRyaWJ1dGUoXCJhcmlhLWV4cGFuZGVkXCIsIFwidHJ1ZVwiKVxuXG4gICAgICAgIGNvbnN0IGV4YW1wbGVDb250YWluZXIgPSBhLmNsb3Nlc3QoXCJsaVwiKSEuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJ1bFwiKS5pdGVtKDApIVxuXG4gICAgICAgIGNvbnN0IGZpcnN0TGFiZWwgPSBleGFtcGxlQ29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoXCJsYWJlbFwiKSBhcyBIVE1MRWxlbWVudFxuICAgICAgICBpZiAoZmlyc3RMYWJlbCkgZmlyc3RMYWJlbC5mb2N1cygpXG5cbiAgICAgICAgLy8gU2V0IGV4YWN0IGhlaWdodCBhbmQgd2lkdGhzIGZvciB0aGUgcG9wb3ZlcnMgZm9yIHRoZSBtYWluIHBsYXlncm91bmQgbmF2aWdhdGlvblxuICAgICAgICBjb25zdCBpc1BsYXlncm91bmRTdWJtZW51ID0gISFhLmNsb3Nlc3QoXCJuYXZcIilcbiAgICAgICAgaWYgKGlzUGxheWdyb3VuZFN1Ym1lbnUpIHtcbiAgICAgICAgICBjb25zdCBwbGF5Z3JvdW5kQ29udGFpbmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJwbGF5Z3JvdW5kLWNvbnRhaW5lclwiKSFcbiAgICAgICAgICBleGFtcGxlQ29udGFpbmVyLnN0eWxlLmhlaWdodCA9IGBjYWxjKCR7cGxheWdyb3VuZENvbnRhaW5lci5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS5oZWlnaHQgKyAyNn1weCAtIDRyZW0pYFxuXG4gICAgICAgICAgY29uc3Qgc2lkZUJhcldpZHRoID0gKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIucGxheWdyb3VuZC1zaWRlYmFyXCIpIGFzIGFueSkub2Zmc2V0V2lkdGhcbiAgICAgICAgICBleGFtcGxlQ29udGFpbmVyLnN0eWxlLndpZHRoID0gYGNhbGMoMTAwJSAtICR7c2lkZUJhcldpZHRofXB4IC0gNzFweClgXG5cbiAgICAgICAgICAvLyBBbGwgdGhpcyBpcyB0byBtYWtlIHN1cmUgdGhhdCB0YWJiaW5nIHN0YXlzIGluc2lkZSB0aGUgZHJvcGRvd24gZm9yIHRzY29uZmlnL2V4YW1wbGVzXG4gICAgICAgICAgY29uc3QgYnV0dG9ucyA9IGV4YW1wbGVDb250YWluZXIucXVlcnlTZWxlY3RvckFsbChcImlucHV0XCIpXG4gICAgICAgICAgY29uc3QgbGFzdEJ1dHRvbiA9IGJ1dHRvbnMuaXRlbShidXR0b25zLmxlbmd0aCAtIDEpIGFzIEhUTUxFbGVtZW50XG4gICAgICAgICAgaWYgKGxhc3RCdXR0b24pIHtcbiAgICAgICAgICAgIHJlZGlyZWN0VGFiUHJlc3NUbyhsYXN0QnV0dG9uLCBleGFtcGxlQ29udGFpbmVyLCBcIi5leGFtcGxlcy1jbG9zZVwiKVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBzZWN0aW9ucyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCJ1bC5leGFtcGxlcy1kcm9wZG93biAuc2VjdGlvbi1jb250ZW50XCIpXG4gICAgICAgICAgICBzZWN0aW9ucy5mb3JFYWNoKHMgPT4ge1xuICAgICAgICAgICAgICBjb25zdCBidXR0b25zID0gcy5xdWVyeVNlbGVjdG9yQWxsKFwiYS5leGFtcGxlLWxpbmtcIilcbiAgICAgICAgICAgICAgY29uc3QgbGFzdEJ1dHRvbiA9IGJ1dHRvbnMuaXRlbShidXR0b25zLmxlbmd0aCAtIDEpIGFzIEhUTUxFbGVtZW50XG4gICAgICAgICAgICAgIGlmIChsYXN0QnV0dG9uKSB7XG4gICAgICAgICAgICAgICAgcmVkaXJlY3RUYWJQcmVzc1RvKGxhc3RCdXR0b24sIGV4YW1wbGVDb250YWluZXIsIFwiLmV4YW1wbGVzLWNsb3NlXCIpXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG4gIH0pXG5cbiAgLy8gSGFuZGxlIGVzY2FwZSBjbG9zaW5nIGRyb3Bkb3ducyBldGNcbiAgZG9jdW1lbnQub25rZXlkb3duID0gZnVuY3Rpb24gKGV2dCkge1xuICAgIGV2dCA9IGV2dCB8fCB3aW5kb3cuZXZlbnRcbiAgICB2YXIgaXNFc2NhcGUgPSBmYWxzZVxuICAgIGlmIChcImtleVwiIGluIGV2dCkge1xuICAgICAgaXNFc2NhcGUgPSBldnQua2V5ID09PSBcIkVzY2FwZVwiIHx8IGV2dC5rZXkgPT09IFwiRXNjXCJcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gQHRzLWlnbm9yZSAtIHRoaXMgdXNlZCB0byBiZSB0aGUgY2FzZVxuICAgICAgaXNFc2NhcGUgPSBldnQua2V5Q29kZSA9PT0gMjdcbiAgICB9XG4gICAgaWYgKGlzRXNjYXBlKSB7XG4gICAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiLm5hdmJhci1zdWIgbGkub3BlblwiKS5mb3JFYWNoKGkgPT4gaS5jbGFzc0xpc3QucmVtb3ZlKFwib3BlblwiKSlcbiAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCIubmF2YmFyLXN1YiBsaVwiKS5mb3JFYWNoKGkgPT4gaS5zZXRBdHRyaWJ1dGUoXCJhcmlhLWV4cGFuZGVkXCIsIFwiZmFsc2VcIikpXG4gICAgfVxuICB9XG5cbiAgY29uc3Qgc2hhcmVBY3Rpb24gPSB7XG4gICAgaWQ6IFwiY29weS1jbGlwYm9hcmRcIixcbiAgICBsYWJlbDogXCJTYXZlIHRvIGNsaXBib2FyZFwiLFxuICAgIGtleWJpbmRpbmdzOiBbbW9uYWNvLktleU1vZC5DdHJsQ21kIHwgbW9uYWNvLktleUNvZGUuS0VZX1NdLFxuXG4gICAgY29udGV4dE1lbnVHcm91cElkOiBcInJ1blwiLFxuICAgIGNvbnRleHRNZW51T3JkZXI6IDEuNSxcblxuICAgIHJ1bjogZnVuY3Rpb24gKCkge1xuICAgICAgd2luZG93Lm5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0KGxvY2F0aW9uLmhyZWYudG9TdHJpbmcoKSkudGhlbihcbiAgICAgICAgKCkgPT4gdWkuZmxhc2hJbmZvKGkoXCJwbGF5X2V4cG9ydF9jbGlwYm9hcmRcIikpLFxuICAgICAgICAoZTogYW55KSA9PiBhbGVydChlKVxuICAgICAgKVxuICAgIH0sXG4gIH1cblxuICBjb25zdCBzaGFyZUJ1dHRvbiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwic2hhcmUtYnV0dG9uXCIpXG4gIGlmIChzaGFyZUJ1dHRvbikge1xuICAgIHNoYXJlQnV0dG9uLm9uY2xpY2sgPSBlID0+IHtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgICAgc2hhcmVBY3Rpb24ucnVuKClcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cblxuICAgIC8vIFNldCB1cCBzb21lIGtleSBjb21tYW5kc1xuICAgIHNhbmRib3guZWRpdG9yLmFkZEFjdGlvbihzaGFyZUFjdGlvbilcblxuICAgIHNhbmRib3guZWRpdG9yLmFkZEFjdGlvbih7XG4gICAgICBpZDogXCJydW4tanNcIixcbiAgICAgIGxhYmVsOiBcIlJ1biB0aGUgZXZhbHVhdGVkIEphdmFTY3JpcHQgZm9yIHlvdXIgVHlwZVNjcmlwdCBmaWxlXCIsXG4gICAgICBrZXliaW5kaW5nczogW21vbmFjby5LZXlNb2QuQ3RybENtZCB8IG1vbmFjby5LZXlDb2RlLkVudGVyXSxcblxuICAgICAgY29udGV4dE1lbnVHcm91cElkOiBcInJ1blwiLFxuICAgICAgY29udGV4dE1lbnVPcmRlcjogMS41LFxuXG4gICAgICBydW46IGZ1bmN0aW9uIChlZCkge1xuICAgICAgICBjb25zdCBydW5CdXR0b24gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInJ1bi1idXR0b25cIilcbiAgICAgICAgcnVuQnV0dG9uICYmIHJ1bkJ1dHRvbi5vbmNsaWNrICYmIHJ1bkJ1dHRvbi5vbmNsaWNrKHt9IGFzIGFueSlcbiAgICAgIH0sXG4gICAgfSlcbiAgfVxuXG4gIGNvbnN0IHJ1bkJ1dHRvbiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwicnVuLWJ1dHRvblwiKVxuICBpZiAocnVuQnV0dG9uKSB7XG4gICAgcnVuQnV0dG9uLm9uY2xpY2sgPSAoKSA9PiB7XG4gICAgICBjb25zdCBydW4gPSBzYW5kYm94LmdldFJ1bm5hYmxlSlMoKVxuICAgICAgY29uc3QgcnVuUGx1Z2luID0gcGx1Z2lucy5maW5kKHAgPT4gcC5pZCA9PT0gXCJsb2dzXCIpIVxuICAgICAgYWN0aXZhdGVQbHVnaW4ocnVuUGx1Z2luLCBnZXRDdXJyZW50UGx1Z2luKCksIHNhbmRib3gsIHRhYkJhciwgY29udGFpbmVyKVxuXG4gICAgICBydW5XaXRoQ3VzdG9tTG9ncyhydW4sIGkpXG5cbiAgICAgIGNvbnN0IGlzSlMgPSBzYW5kYm94LmNvbmZpZy51c2VKYXZhU2NyaXB0XG4gICAgICB1aS5mbGFzaEluZm8oaShpc0pTID8gXCJwbGF5X3J1bl9qc1wiIDogXCJwbGF5X3J1bl90c1wiKSlcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cbiAgfVxuXG4gIC8vIEhhbmRsZSB0aGUgY2xvc2UgYnV0dG9ucyBvbiB0aGUgZXhhbXBsZXNcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcImJ1dHRvbi5leGFtcGxlcy1jbG9zZVwiKS5mb3JFYWNoKGIgPT4ge1xuICAgIGNvbnN0IGJ1dHRvbiA9IGIgYXMgSFRNTEJ1dHRvbkVsZW1lbnRcbiAgICBidXR0b24ub25jbGljayA9IChlOiBhbnkpID0+IHtcbiAgICAgIGNvbnN0IGJ1dHRvbiA9IGUudGFyZ2V0IGFzIEhUTUxCdXR0b25FbGVtZW50XG4gICAgICBjb25zdCBuYXZMSSA9IGJ1dHRvbi5jbG9zZXN0KFwibGlcIilcbiAgICAgIG5hdkxJPy5jbGFzc0xpc3QucmVtb3ZlKFwib3BlblwiKVxuICAgIH1cbiAgfSlcblxuICBzZXR1cFNpZGViYXJUb2dnbGUoKVxuXG4gIGlmIChkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImNvbmZpZy1jb250YWluZXJcIikpIHtcbiAgICBjcmVhdGVDb25maWdEcm9wZG93bihzYW5kYm94LCBtb25hY28pXG4gICAgdXBkYXRlQ29uZmlnRHJvcGRvd25Gb3JDb21waWxlck9wdGlvbnMoc2FuZGJveCwgbW9uYWNvKVxuICB9XG5cbiAgaWYgKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwicGxheWdyb3VuZC1zZXR0aW5nc1wiKSkge1xuICAgIGNvbnN0IHNldHRpbmdzVG9nZ2xlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJwbGF5Z3JvdW5kLXNldHRpbmdzXCIpIVxuXG4gICAgc2V0dGluZ3NUb2dnbGUub25jbGljayA9ICgpID0+IHtcbiAgICAgIGNvbnN0IG9wZW4gPSBzZXR0aW5nc1RvZ2dsZS5wYXJlbnRFbGVtZW50IS5jbGFzc0xpc3QuY29udGFpbnMoXCJvcGVuXCIpXG4gICAgICBjb25zdCBzaWRlYmFyVGFicyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIucGxheWdyb3VuZC1wbHVnaW4tdGFidmlld1wiKSBhcyBIVE1MRGl2RWxlbWVudFxuICAgICAgY29uc3Qgc2lkZWJhckNvbnRlbnQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiLnBsYXlncm91bmQtcGx1Z2luLWNvbnRhaW5lclwiKSBhcyBIVE1MRGl2RWxlbWVudFxuICAgICAgbGV0IHNldHRpbmdzQ29udGVudCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIucGxheWdyb3VuZC1zZXR0aW5ncy1jb250YWluZXJcIikgYXMgSFRNTERpdkVsZW1lbnRcblxuICAgICAgaWYgKCFzZXR0aW5nc0NvbnRlbnQpIHtcbiAgICAgICAgc2V0dGluZ3NDb250ZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuICAgICAgICBzZXR0aW5nc0NvbnRlbnQuY2xhc3NOYW1lID0gXCJwbGF5Z3JvdW5kLXNldHRpbmdzLWNvbnRhaW5lciBwbGF5Z3JvdW5kLXBsdWdpbi1jb250YWluZXJcIlxuICAgICAgICBjb25zdCBzZXR0aW5ncyA9IHNldHRpbmdzUGx1Z2luKGksIHV0aWxzKVxuICAgICAgICBzZXR0aW5ncy5kaWRNb3VudCAmJiBzZXR0aW5ncy5kaWRNb3VudChzYW5kYm94LCBzZXR0aW5nc0NvbnRlbnQpXG4gICAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIucGxheWdyb3VuZC1zaWRlYmFyXCIpIS5hcHBlbmRDaGlsZChzZXR0aW5nc0NvbnRlbnQpXG5cbiAgICAgICAgLy8gV2hlbiB0aGUgbGFzdCB0YWIgaXRlbSBpcyBoaXQsIGdvIGJhY2sgdG8gdGhlIHNldHRpbmdzIGJ1dHRvblxuICAgICAgICBjb25zdCBsYWJlbHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiLnBsYXlncm91bmQtc2lkZWJhciBpbnB1dFwiKVxuICAgICAgICBjb25zdCBsYXN0TGFiZWwgPSBsYWJlbHMuaXRlbShsYWJlbHMubGVuZ3RoIC0gMSkgYXMgSFRNTEVsZW1lbnRcbiAgICAgICAgaWYgKGxhc3RMYWJlbCkge1xuICAgICAgICAgIHJlZGlyZWN0VGFiUHJlc3NUbyhsYXN0TGFiZWwsIHVuZGVmaW5lZCwgXCIjcGxheWdyb3VuZC1zZXR0aW5nc1wiKVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChvcGVuKSB7XG4gICAgICAgIHNpZGViYXJUYWJzLnN0eWxlLmRpc3BsYXkgPSBcImZsZXhcIlxuICAgICAgICBzaWRlYmFyQ29udGVudC5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiXG4gICAgICAgIHNldHRpbmdzQ29udGVudC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCJcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNpZGViYXJUYWJzLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIlxuICAgICAgICBzaWRlYmFyQ29udGVudC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCJcbiAgICAgICAgc2V0dGluZ3NDb250ZW50LnN0eWxlLmRpc3BsYXkgPSBcImJsb2NrXCJcbiAgICAgICAgOyhkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiLnBsYXlncm91bmQtc2lkZWJhciBsYWJlbFwiKSBhcyBhbnkpLmZvY3VzKClcbiAgICAgIH1cbiAgICAgIHNldHRpbmdzVG9nZ2xlLnBhcmVudEVsZW1lbnQhLmNsYXNzTGlzdC50b2dnbGUoXCJvcGVuXCIpXG4gICAgfVxuXG4gICAgc2V0dGluZ3NUb2dnbGUuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgZSA9PiB7XG4gICAgICBjb25zdCBpc09wZW4gPSBzZXR0aW5nc1RvZ2dsZS5wYXJlbnRFbGVtZW50IS5jbGFzc0xpc3QuY29udGFpbnMoXCJvcGVuXCIpXG4gICAgICBpZiAoZS5rZXlDb2RlID09PSA5ICYmIGlzT3Blbikge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiLnBsYXlncm91bmQtb3B0aW9ucyBsaSBpbnB1dFwiKSBhcyBhbnlcbiAgICAgICAgcmVzdWx0LmZvY3VzKClcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgICB9XG4gICAgfSlcbiAgfVxuXG4gIC8vIFN1cHBvcnQgZ3JhYmJpbmcgZXhhbXBsZXMgZnJvbSB0aGUgbG9jYXRpb24gaGFzaFxuICBpZiAobG9jYXRpb24uaGFzaC5zdGFydHNXaXRoKFwiI2V4YW1wbGVcIikpIHtcbiAgICBjb25zdCBleGFtcGxlTmFtZSA9IGxvY2F0aW9uLmhhc2gucmVwbGFjZShcIiNleGFtcGxlL1wiLCBcIlwiKS50cmltKClcbiAgICBzYW5kYm94LmNvbmZpZy5sb2dnZXIubG9nKFwiTG9hZGluZyBleGFtcGxlOlwiLCBleGFtcGxlTmFtZSlcbiAgICBnZXRFeGFtcGxlU291cmNlQ29kZShjb25maWcucHJlZml4LCBjb25maWcubGFuZywgZXhhbXBsZU5hbWUpLnRoZW4oZXggPT4ge1xuICAgICAgaWYgKGV4LmV4YW1wbGUgJiYgZXguY29kZSkge1xuICAgICAgICBjb25zdCB7IGV4YW1wbGUsIGNvZGUgfSA9IGV4XG5cbiAgICAgICAgLy8gVXBkYXRlIHRoZSBsb2NhbHN0b3JhZ2Ugc2hvd2luZyB0aGF0IHlvdSd2ZSBzZWVuIHRoaXMgcGFnZVxuICAgICAgICBpZiAobG9jYWxTdG9yYWdlKSB7XG4gICAgICAgICAgY29uc3Qgc2VlblRleHQgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbShcImV4YW1wbGVzLXNlZW5cIikgfHwgXCJ7fVwiXG4gICAgICAgICAgY29uc3Qgc2VlbiA9IEpTT04ucGFyc2Uoc2VlblRleHQpXG4gICAgICAgICAgc2VlbltleGFtcGxlLmlkXSA9IGV4YW1wbGUuaGFzaFxuICAgICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKFwiZXhhbXBsZXMtc2VlblwiLCBKU09OLnN0cmluZ2lmeShzZWVuKSlcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGFsbExpbmtzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcImV4YW1wbGUtbGlua1wiKVxuICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgIGZvciAoY29uc3QgbGluayBvZiBhbGxMaW5rcykge1xuICAgICAgICAgIGlmIChsaW5rLnRleHRDb250ZW50ID09PSBleGFtcGxlLnRpdGxlKSB7XG4gICAgICAgICAgICBsaW5rLmNsYXNzTGlzdC5hZGQoXCJoaWdobGlnaHRcIilcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBkb2N1bWVudC50aXRsZSA9IFwiVHlwZVNjcmlwdCBQbGF5Z3JvdW5kIC0gXCIgKyBleGFtcGxlLnRpdGxlXG4gICAgICAgIHN1cHByZXNzTmV4dFRleHRDaGFuZ2VGb3JIYXNoQ2hhbmdlID0gdHJ1ZVxuICAgICAgICBzYW5kYm94LnNldFRleHQoY29kZSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN1cHByZXNzTmV4dFRleHRDaGFuZ2VGb3JIYXNoQ2hhbmdlID0gdHJ1ZVxuICAgICAgICBzYW5kYm94LnNldFRleHQoXCIvLyBUaGVyZSB3YXMgYW4gaXNzdWUgZ2V0dGluZyB0aGUgZXhhbXBsZSwgYmFkIFVSTD8gQ2hlY2sgdGhlIGNvbnNvbGUgaW4gdGhlIGRldmVsb3BlciB0b29sc1wiKVxuICAgICAgfVxuICAgIH0pXG4gIH1cblxuICAvLyBUaGlzIGlzbid0IG9wdGltYWwsIGJ1dCBpdCdzIGdvb2QgZW5vdWdoIHdpdGhvdXQgbWUgYWRkaW5nIHN1cHBvcnRcbiAgLy8gZm9yIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvbW9uYWNvLWVkaXRvci9pc3N1ZXMvMzEzXG4gIHNldEludGVydmFsKCgpID0+IHtcbiAgICBjb25zdCBtYXJrZXJzID0gc2FuZGJveC5tb25hY28uZWRpdG9yLmdldE1vZGVsTWFya2Vycyh7fSlcbiAgICB1dGlscy5zZXROb3RpZmljYXRpb25zKFwiZXJyb3JzXCIsIG1hcmtlcnMubGVuZ3RoKVxuICB9LCA1MDApXG5cbiAgLy8gU2V0cyB1cCBhIHdheSB0byBjbGljayBiZXR3ZWVuIGV4YW1wbGVzXG4gIG1vbmFjby5sYW5ndWFnZXMucmVnaXN0ZXJMaW5rUHJvdmlkZXIoc2FuZGJveC5sYW5ndWFnZSwgbmV3IEV4YW1wbGVIaWdobGlnaHRlcigpKVxuXG4gIGNvbnN0IGxhbmd1YWdlU2VsZWN0b3IgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImxhbmd1YWdlLXNlbGVjdG9yXCIpIGFzIEhUTUxTZWxlY3RFbGVtZW50XG4gIGlmIChsYW5ndWFnZVNlbGVjdG9yKSB7XG4gICAgY29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcyhsb2NhdGlvbi5zZWFyY2gpXG4gICAgbGFuZ3VhZ2VTZWxlY3Rvci5vcHRpb25zLnNlbGVjdGVkSW5kZXggPSBwYXJhbXMuZ2V0KFwidXNlSmF2YVNjcmlwdFwiKSA/IDEgOiAwXG5cbiAgICBsYW5ndWFnZVNlbGVjdG9yLm9uY2hhbmdlID0gKCkgPT4ge1xuICAgICAgY29uc3QgdXNlSmF2YVNjcmlwdCA9IGxhbmd1YWdlU2VsZWN0b3IudmFsdWUgPT09IFwiSmF2YVNjcmlwdFwiXG4gICAgICBjb25zdCBxdWVyeSA9IHNhbmRib3guY3JlYXRlVVJMUXVlcnlXaXRoQ29tcGlsZXJPcHRpb25zKHNhbmRib3gsIHtcbiAgICAgICAgdXNlSmF2YVNjcmlwdDogdXNlSmF2YVNjcmlwdCA/IHRydWUgOiB1bmRlZmluZWQsXG4gICAgICB9KVxuICAgICAgY29uc3QgZnVsbFVSTCA9IGAke2RvY3VtZW50LmxvY2F0aW9uLnByb3RvY29sfS8vJHtkb2N1bWVudC5sb2NhdGlvbi5ob3N0fSR7ZG9jdW1lbnQubG9jYXRpb24ucGF0aG5hbWV9JHtxdWVyeX1gXG4gICAgICAvLyBAdHMtaWdub3JlXG4gICAgICBkb2N1bWVudC5sb2NhdGlvbiA9IGZ1bGxVUkxcbiAgICB9XG4gIH1cblxuICAvLyBFbnN1cmUgdGhhdCB0aGUgZWRpdG9yIGlzIGZ1bGwtd2lkdGggd2hlbiB0aGUgc2NyZWVuIHJlc2l6ZXNcbiAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJyZXNpemVcIiwgKCkgPT4ge1xuICAgIHNhbmRib3guZWRpdG9yLmxheW91dCgpXG4gIH0pXG5cbiAgY29uc3QgdWkgPSBjcmVhdGVVSSgpXG4gIGNvbnN0IGV4cG9ydGVyID0gY3JlYXRlRXhwb3J0ZXIoc2FuZGJveCwgbW9uYWNvLCB1aSlcblxuICBjb25zdCBwbGF5Z3JvdW5kID0ge1xuICAgIGV4cG9ydGVyLFxuICAgIHVpLFxuICAgIHJlZ2lzdGVyUGx1Z2luLFxuICAgIHBsdWdpbnMsXG4gICAgZ2V0Q3VycmVudFBsdWdpbixcbiAgICB0YWJzLFxuICAgIHNldERpZFVwZGF0ZVRhYixcbiAgICBjcmVhdGVVdGlscyxcbiAgfVxuXG4gIHdpbmRvdy50cyA9IHNhbmRib3gudHNcbiAgd2luZG93LnNhbmRib3ggPSBzYW5kYm94XG4gIHdpbmRvdy5wbGF5Z3JvdW5kID0gcGxheWdyb3VuZFxuXG4gIGNvbnNvbGUubG9nKGBVc2luZyBUeXBlU2NyaXB0ICR7d2luZG93LnRzLnZlcnNpb259YClcblxuICBjb25zb2xlLmxvZyhcIkF2YWlsYWJsZSBnbG9iYWxzOlwiKVxuICBjb25zb2xlLmxvZyhcIlxcdHdpbmRvdy50c1wiLCB3aW5kb3cudHMpXG4gIGNvbnNvbGUubG9nKFwiXFx0d2luZG93LnNhbmRib3hcIiwgd2luZG93LnNhbmRib3gpXG4gIGNvbnNvbGUubG9nKFwiXFx0d2luZG93LnBsYXlncm91bmRcIiwgd2luZG93LnBsYXlncm91bmQpXG4gIGNvbnNvbGUubG9nKFwiXFx0d2luZG93LnJlYWN0XCIsIHdpbmRvdy5yZWFjdClcbiAgY29uc29sZS5sb2coXCJcXHR3aW5kb3cucmVhY3RET01cIiwgd2luZG93LnJlYWN0RE9NKVxuXG4gIC8qKiBBIHBsdWdpbiAqL1xuICBjb25zdCBhY3RpdmF0ZUV4dGVybmFsUGx1Z2luID0gKFxuICAgIHBsdWdpbjogUGxheWdyb3VuZFBsdWdpbiB8ICgodXRpbHM6IFBsdWdpblV0aWxzKSA9PiBQbGF5Z3JvdW5kUGx1Z2luKSxcbiAgICBhdXRvQWN0aXZhdGU6IGJvb2xlYW5cbiAgKSA9PiB7XG4gICAgbGV0IHJlYWR5UGx1Z2luOiBQbGF5Z3JvdW5kUGx1Z2luXG4gICAgLy8gQ2FuIGVpdGhlciBiZSBhIGZhY3RvcnksIG9yIG9iamVjdFxuICAgIGlmICh0eXBlb2YgcGx1Z2luID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIGNvbnN0IHV0aWxzID0gY3JlYXRlVXRpbHMoc2FuZGJveCwgcmVhY3QpXG4gICAgICByZWFkeVBsdWdpbiA9IHBsdWdpbih1dGlscylcbiAgICB9IGVsc2Uge1xuICAgICAgcmVhZHlQbHVnaW4gPSBwbHVnaW5cbiAgICB9XG5cbiAgICBpZiAoYXV0b0FjdGl2YXRlKSB7XG4gICAgICBjb25zb2xlLmxvZyhyZWFkeVBsdWdpbilcbiAgICB9XG5cbiAgICBwbGF5Z3JvdW5kLnJlZ2lzdGVyUGx1Z2luKHJlYWR5UGx1Z2luKVxuXG4gICAgLy8gQXV0by1zZWxlY3QgdGhlIGRldiBwbHVnaW5cbiAgICBjb25zdCBwbHVnaW5XYW50c0Zyb250ID0gcmVhZHlQbHVnaW4uc2hvdWxkQmVTZWxlY3RlZCAmJiByZWFkeVBsdWdpbi5zaG91bGRCZVNlbGVjdGVkKClcblxuICAgIGlmIChwbHVnaW5XYW50c0Zyb250IHx8IGF1dG9BY3RpdmF0ZSkge1xuICAgICAgLy8gQXV0by1zZWxlY3QgdGhlIGRldiBwbHVnaW5cbiAgICAgIGFjdGl2YXRlUGx1Z2luKHJlYWR5UGx1Z2luLCBnZXRDdXJyZW50UGx1Z2luKCksIHNhbmRib3gsIHRhYkJhciwgY29udGFpbmVyKVxuICAgIH1cbiAgfVxuXG4gIC8vIERldiBtb2RlIHBsdWdpblxuICBpZiAoY29uZmlnLnN1cHBvcnRDdXN0b21QbHVnaW5zICYmIGFsbG93Q29ubmVjdGluZ1RvTG9jYWxob3N0KCkpIHtcbiAgICB3aW5kb3cuZXhwb3J0cyA9IHt9XG4gICAgY29uc29sZS5sb2coXCJDb25uZWN0aW5nIHRvIGRldiBwbHVnaW5cIilcbiAgICB0cnkge1xuICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgY29uc3QgcmUgPSB3aW5kb3cucmVxdWlyZVxuICAgICAgcmUoW1wibG9jYWwvaW5kZXhcIl0sIChkZXZQbHVnaW46IGFueSkgPT4ge1xuICAgICAgICBjb25zb2xlLmxvZyhcIlNldCB1cCBkZXYgcGx1Z2luIGZyb20gbG9jYWxob3N0OjUwMDBcIilcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBhY3RpdmF0ZUV4dGVybmFsUGx1Z2luKGRldlBsdWdpbiwgdHJ1ZSlcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKGVycm9yKVxuICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgdWkuZmxhc2hJbmZvKFwiRXJyb3I6IENvdWxkIG5vdCBsb2FkIGRldiBwbHVnaW4gZnJvbSBsb2NhbGhvc3Q6NTAwMFwiKVxuICAgICAgICAgIH0sIDcwMClcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcihcIlByb2JsZW0gbG9hZGluZyB1cCB0aGUgZGV2IHBsdWdpblwiKVxuICAgICAgY29uc29sZS5lcnJvcihlcnJvcilcbiAgICB9XG4gIH1cblxuICBjb25zdCBkb3dubG9hZFBsdWdpbiA9IChwbHVnaW46IHN0cmluZywgYXV0b0VuYWJsZTogYm9vbGVhbikgPT4ge1xuICAgIHRyeSB7XG4gICAgICAvLyBAdHMtaWdub3JlXG4gICAgICBjb25zdCByZSA9IHdpbmRvdy5yZXF1aXJlXG4gICAgICByZShbYHVucGtnLyR7cGx1Z2lufUBsYXRlc3QvZGlzdC9pbmRleGBdLCAoZGV2UGx1Z2luOiBQbGF5Z3JvdW5kUGx1Z2luKSA9PiB7XG4gICAgICAgIGFjdGl2YXRlRXh0ZXJuYWxQbHVnaW4oZGV2UGx1Z2luLCBhdXRvRW5hYmxlKVxuICAgICAgfSlcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcihcIlByb2JsZW0gbG9hZGluZyB1cCB0aGUgcGx1Z2luOlwiLCBwbHVnaW4pXG4gICAgICBjb25zb2xlLmVycm9yKGVycm9yKVxuICAgIH1cbiAgfVxuXG4gIGlmIChjb25maWcuc3VwcG9ydEN1c3RvbVBsdWdpbnMpIHtcbiAgICAvLyBHcmFiIG9uZXMgZnJvbSBsb2NhbHN0b3JhZ2VcbiAgICBhY3RpdmVQbHVnaW5zKCkuZm9yRWFjaChwID0+IGRvd25sb2FkUGx1Z2luKHAuaWQsIGZhbHNlKSlcblxuICAgIC8vIE9mZmVyIHRvIGluc3RhbGwgb25lIGlmICdpbnN0YWxsLXBsdWdpbicgaXMgYSBxdWVyeSBwYXJhbVxuICAgIGNvbnN0IHBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMobG9jYXRpb24uc2VhcmNoKVxuICAgIGNvbnN0IHBsdWdpblRvSW5zdGFsbCA9IHBhcmFtcy5nZXQoXCJpbnN0YWxsLXBsdWdpblwiKVxuICAgIGlmIChwbHVnaW5Ub0luc3RhbGwpIHtcbiAgICAgIGNvbnN0IGFscmVhZHlJbnN0YWxsZWQgPSBhY3RpdmVQbHVnaW5zKCkuZmluZChwID0+IHAuaWQgPT09IHBsdWdpblRvSW5zdGFsbClcbiAgICAgIGlmICghYWxyZWFkeUluc3RhbGxlZCkge1xuICAgICAgICBjb25zdCBzaG91bGREb0l0ID0gY29uZmlybShcIldvdWxkIHlvdSBsaWtlIHRvIGluc3RhbGwgdGhlIHRoaXJkIHBhcnR5IHBsdWdpbj9cXG5cXG5cIiArIHBsdWdpblRvSW5zdGFsbClcbiAgICAgICAgaWYgKHNob3VsZERvSXQpIHtcbiAgICAgICAgICBhZGRDdXN0b21QbHVnaW4ocGx1Z2luVG9JbnN0YWxsKVxuICAgICAgICAgIGRvd25sb2FkUGx1Z2luKHBsdWdpblRvSW5zdGFsbCwgdHJ1ZSlcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGlmIChsb2NhdGlvbi5oYXNoLnN0YXJ0c1dpdGgoXCIjc2hvdy1leGFtcGxlc1wiKSkge1xuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJleGFtcGxlcy1idXR0b25cIik/LmNsaWNrKClcbiAgICB9LCAxMDApXG4gIH1cblxuICBpZiAobG9jYXRpb24uaGFzaC5zdGFydHNXaXRoKFwiI3Nob3ctd2hhdGlzbmV3XCIpKSB7XG4gICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcIndoYXRpc25ldy1idXR0b25cIik/LmNsaWNrKClcbiAgICB9LCAxMDApXG4gIH1cblxuICByZXR1cm4gcGxheWdyb3VuZFxufVxuXG5leHBvcnQgdHlwZSBQbGF5Z3JvdW5kID0gUmV0dXJuVHlwZTx0eXBlb2Ygc2V0dXBQbGF5Z3JvdW5kPlxuXG5jb25zdCByZWRpcmVjdFRhYlByZXNzVG8gPSAoZWxlbWVudDogSFRNTEVsZW1lbnQsIGNvbnRhaW5lcjogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQsIHF1ZXJ5OiBzdHJpbmcpID0+IHtcbiAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCBlID0+IHtcbiAgICBpZiAoZS5rZXlDb2RlID09PSA5KSB7XG4gICAgICBjb25zdCBob3N0ID0gY29udGFpbmVyIHx8IGRvY3VtZW50XG4gICAgICBjb25zdCByZXN1bHQgPSBob3N0LnF1ZXJ5U2VsZWN0b3IocXVlcnkpIGFzIGFueVxuICAgICAgaWYgKCFyZXN1bHQpIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgdG8gZmluZCBhIHJlc3VsdCBmb3Iga2V5ZG93bmApXG4gICAgICByZXN1bHQuZm9jdXMoKVxuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgfVxuICB9KVxufVxuIl19