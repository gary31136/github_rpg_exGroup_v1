/*:
 * @target MZ
 * @plugindesc 玩家行為紀錄系統（開始遊戲/地圖/時間）v1.0
 * @author ChatGPT
 *
 * @help
 * 這個插件會在以下情況記錄玩家行為：
 * 1. 開始新遊戲
 * 2. 進入地圖時
 *
 * 在 NW.js / Windows 本機執行時：
 * - 寫入遊戲資料夾下的 data/player_log.txt
 *
 * 在瀏覽器 / GitHub Pages / iPad 時：
 * - 改存到 localStorage，不會因 require('fs') 報錯
 *
 * 你可以之後再擴充：
 * - 對話選項紀錄
 * - 購買行為紀錄
 * - 投資選擇紀錄
 * - 關卡完成紀錄
 

(() => {
    "use strict";

    const Logger = {};

    Logger.fileName = "player_log.txt";
    Logger.storageKey = "MZ_PlayerLog";

    Logger.isNwjs = function() {
        return Utils.isNwjs();
    };

    Logger.nowString = function() {
        const dt = new Date();
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, "0");
        const d = String(dt.getDate()).padStart(2, "0");
        const h = String(dt.getHours()).padStart(2, "0");
        const min = String(dt.getMinutes()).padStart(2, "0");
        const s = String(dt.getSeconds()).padStart(2, "0");
        return `${y}/${m}/${d} ${h}:${min}:${s}`;
    };

    Logger.makeLogText = function(action, extra = "") {
        const mapName = $gameMap ? ($dataMapInfos[$gameMap.mapId()]?.name || `Map${$gameMap.mapId()}`) : "未知地圖";
        const time = Logger.nowString();
        return `[${time}] ${action} | 地圖: ${mapName}${extra ? " | " + extra : ""}\n`;
    };

    Logger.getLocalFilePath = function() {
        const path = require("path");
        const base = path.dirname(process.mainModule.filename);
        return path.join(base, "data", Logger.fileName);
    };

    Logger.writeToFile = function(text) {
        try {
            const fs = require("fs");
            const filePath = Logger.getLocalFilePath();
            fs.appendFileSync(filePath, text, "utf8");
        } catch (e) {
            console.error("寫入檔案失敗，改存到 localStorage：", e);
            Logger.writeToStorage(text);
        }
    };

    Logger.writeToStorage = function(text) {
        try {
            const oldText = localStorage.getItem(Logger.storageKey) || "";
            localStorage.setItem(Logger.storageKey, oldText + text);
        } catch (e) {
            console.error("localStorage 寫入失敗：", e);
        }
    };

    Logger.log = function(action, extra = "") {
        const text = Logger.makeLogText(action, extra);

        if (Logger.isNwjs()) {
            Logger.writeToFile(text);
        } else {
            Logger.writeToStorage(text);
        }

        console.log(text);
    };

    // ==============================
    // 1. 開始新遊戲時紀錄
    // ==============================
    const _DataManager_setupNewGame = DataManager.setupNewGame;
    DataManager.setupNewGame = function() {
        _DataManager_setupNewGame.call(this);
        Logger.log("開始新遊戲");
    };

    // ==============================
    // 2. 載入存檔時紀錄
    // ==============================
    const _DataManager_loadGame = DataManager.loadGame;
    DataManager.loadGame = function(savefileId) {
        const result = _DataManager_loadGame.call(this, savefileId);
        Promise.resolve(result).then(success => {
            if (success) {
                Logger.log("載入存檔", `存檔編號: ${savefileId}`);
            }
        });
        return result;
    };

    // ==============================
    // 3. 進入地圖時紀錄
    // ==============================
    const _Scene_Map_start = Scene_Map.prototype.start;
    Scene_Map.prototype.start = function() {
        _Scene_Map_start.call(this);
        Logger.log("進入地圖");
    };

    // ==============================
    // 4. 提供全域函式，可事件呼叫
    //    腳本：PlayerLogger.logAction("買入股票", "金額:100")
    // ==============================
    window.PlayerLogger = {
        logAction(action, extra = "") {
            Logger.log(action, extra);
        },

        showBrowserLog() {
            if (Logger.isNwjs()) {
                console.log("目前為本機模式，請直接查看 data/player_log.txt");
            } else {
                const log = localStorage.getItem(Logger.storageKey) || "";
                console.log(log);
                alert(log || "目前沒有紀錄");
            }
        },

        clearBrowserLog() {
            if (!Logger.isNwjs()) {
                localStorage.removeItem(Logger.storageKey);
                alert("瀏覽器紀錄已清除");
            }
        }
    };
    window.PlayerLogger.downloadLog = function () {

        const key = "MZ_PlayerLog";
        const text = localStorage.getItem(key) || "沒有紀錄";

        const blob = new Blob([text], { type: "text/plain" });

        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);

        const now = new Date();
        const fileName =
            "player_log_" +
            now.getFullYear() +
            (now.getMonth() + 1) +
            now.getDate() +
            "_" +
            now.getHours() +
            now.getMinutes() +
            ".txt";

        a.download = fileName;
        a.click();
    };
})();*/



/*:
 * @target MZ
 * @plugindesc 玩家行為紀錄系統（本機寫檔 / 網頁 localStorage / 可匯出）v1.2
 * @author ChatGPT
 *
 * @help
 * 【功能】
 * 1. 開始新遊戲時自動紀錄
 * 2. 進入地圖時自動紀錄
 * 3. 載入存檔時自動紀錄
 * 4. 本機 NW.js 模式：寫入 data/player_log.txt
 * 5. 網頁 / GitHub Pages / 手機：寫入 localStorage
 * 6. 可顯示、清除、匯出紀錄
 *
 * 【事件腳本可用指令】
 * PlayerLogger.logAction("行為名稱");
 * PlayerLogger.logAction("行為名稱", "補充資訊");
 * PlayerLogger.showLog();
 * PlayerLogger.clearLog();
 * PlayerLogger.exportLog();
 */

(() => {
    "use strict";

    const Logger = {};
    Logger.fileName = "player_log.txt";
    Logger.storageKey = "MZ_PlayerLog";

    Logger.isNwjs = function() {
        return Utils.isNwjs();
    };

    Logger.nowString = function() {
        const dt = new Date();
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, "0");
        const d = String(dt.getDate()).padStart(2, "0");
        const h = String(dt.getHours()).padStart(2, "0");
        const min = String(dt.getMinutes()).padStart(2, "0");
        const s = String(dt.getSeconds()).padStart(2, "0");
        return `${y}/${m}/${d} ${h}:${min}:${s}`;
    };

    Logger.currentMapName = function() {
        try {
            if ($gameMap && $dataMapInfos) {
                const mapId = $gameMap.mapId();
                if ($dataMapInfos[mapId] && $dataMapInfos[mapId].name) {
                    return $dataMapInfos[mapId].name;
                }
                return `Map${mapId}`;
            }
        } catch (e) {
            console.error(e);
        }
        return "未知地圖";
    };

    Logger.makeLogText = function(action, extra = "") {
        const time = Logger.nowString();
        const mapName = Logger.currentMapName();
        return `[${time}] ${action} | 地圖: ${mapName}${extra ? " | " + extra : ""}\n`;
    };

    Logger.getLocalFilePath = function() {
        const path = require("path");
        const base = path.dirname(process.mainModule.filename);
        return path.join(base, "data", Logger.fileName);
    };

    Logger.writeToFile = function(text) {
        try {
            const fs = require("fs");
            const filePath = Logger.getLocalFilePath();
            fs.appendFileSync(filePath, text, "utf8");
        } catch (e) {
            console.error("寫入檔案失敗，改存到 localStorage：", e);
            Logger.writeToStorage(text);
        }
    };

    Logger.writeToStorage = function(text) {
        try {
            const oldText = localStorage.getItem(Logger.storageKey) || "";
            localStorage.setItem(Logger.storageKey, oldText + text);
        } catch (e) {
            console.error("localStorage 寫入失敗：", e);
        }
    };

    Logger.readFromFile = function() {
        try {
            const fs = require("fs");
            const filePath = Logger.getLocalFilePath();
            if (!fs.existsSync(filePath)) return "";
            return fs.readFileSync(filePath, "utf8");
        } catch (e) {
            console.error("讀取檔案失敗：", e);
            return "";
        }
    };

    Logger.readFromStorage = function() {
        try {
            return localStorage.getItem(Logger.storageKey) || "";
        } catch (e) {
            console.error("讀取 localStorage 失敗：", e);
            return "";
        }
    };

    Logger.clearFile = function() {
        try {
            const fs = require("fs");
            const filePath = Logger.getLocalFilePath();
            fs.writeFileSync(filePath, "", "utf8");
        } catch (e) {
            console.error("清除檔案失敗：", e);
        }
    };

    Logger.clearStorage = function() {
        try {
            localStorage.removeItem(Logger.storageKey);
        } catch (e) {
            console.error("清除 localStorage 失敗：", e);
        }
    };

    Logger.log = function(action, extra = "") {
        const text = Logger.makeLogText(action, extra);

        if (Logger.isNwjs()) {
            Logger.writeToFile(text);
        } else {
            Logger.writeToStorage(text);
        }

        console.log(text);
    };

    Logger.getAllLogText = function() {
        if (Logger.isNwjs()) {
            return Logger.readFromFile();
        } else {
            return Logger.readFromStorage();
        }
    };

    Logger.clearAllLog = function() {
        if (Logger.isNwjs()) {
            Logger.clearFile();
        } else {
            Logger.clearStorage();
        }
    };

    Logger.downloadTextFile = function(filename, text) {
        const blob = new Blob(["\ufeff" + text], { type: "text/plain;charset=utf-8" });
        const a = document.createElement("a");
        const url = URL.createObjectURL(blob);

        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    // 自動紀錄：開始新遊戲
    const _DataManager_setupNewGame = DataManager.setupNewGame;
    DataManager.setupNewGame = function() {
        _DataManager_setupNewGame.call(this);
        Logger.log("開始新遊戲");
    };

    // 自動紀錄：載入存檔
    const _DataManager_loadGame = DataManager.loadGame;
    DataManager.loadGame = function(savefileId) {
        const result = _DataManager_loadGame.call(this, savefileId);
        Promise.resolve(result).then(success => {
            if (success) {
                Logger.log("載入存檔", `存檔編號: ${savefileId}`);
            }
        });
        return result;
    };

    // 自動紀錄：進入地圖
    const _Scene_Map_start = Scene_Map.prototype.start;
    Scene_Map.prototype.start = function() {
        _Scene_Map_start.call(this);
        Logger.log("進入地圖");
    };

    window.PlayerLogger = {
        logAction(action, extra = "") {
            Logger.log(action, extra);
        },

        showLog() {
            const log = Logger.getAllLogText();
            if (log.trim()) {
                console.log(log);
                alert(log);
            } else {
                console.log("目前沒有紀錄。");
                alert("目前沒有紀錄。");
            }
        },

        clearLog() {
            Logger.clearAllLog();
            console.log("紀錄已清除。");
            alert("紀錄已清除。");
        },

        exportLog() {
            const log = Logger.getAllLogText();

            if (!log.trim()) {
                console.log("目前沒有可匯出的紀錄。");
                alert("目前沒有可匯出的紀錄。");
                return;
            }

            Logger.downloadTextFile(Logger.fileName, log);
            console.log("紀錄已匯出。");
        }
    };
})();