/*:
 * @target MZ
 * @plugindesc 在事件/NPC頭上顯示「文字標籤 + 指定變數數值」，可用於顯示理財獲利 v2.1
 * @author ChatGPT
 *
 * @param showSwitchId
 * @text 顯示控制開關ID
 * @type switch
 * @default 0
 * @desc 若設為0則永遠顯示；若設為其他開關ID，則該開關ON時才顯示。
 *
 * @param fontSize
 * @text 字體大小
 * @type number
 * @min 8
 * @default 22
 *
 * @param offsetY
 * @text 垂直偏移
 * @type number
 * @default -65
 * @desc 數值越小會顯示得越高；越接近0越靠近NPC頭部。
 *
 * @param showZero
 * @text 是否顯示0
 * @type boolean
 * @on 顯示
 * @off 不顯示
 * @default false
 *
 * @param textWidth
 * @text 文字寬度
 * @type number
 * @min 60
 * @default 240
 * @desc 頭上文字的顯示寬度，若像「高風險:+3000」太長可調大。
 *
 * @help
 * === 功能說明 ===
 * 本插件可在地圖事件/NPC頭上顯示：
 * 「自訂文字 + 變數值」
 *
 * 適合用於：
 * - 儲蓄:+300
 * - 低風險:+100
 * - 中風險:-80
 * - 高風險:+600
 *
 * --------------------------------------------------
 * 【使用方式】
 * 在要顯示文字的事件頁「註解」中加入：
 *
 * <profitVar:11>
 * <profitText:儲蓄>
 *
 * 代表此NPC頭上會顯示：
 * 儲蓄:+變數11的值
 *
 * --------------------------------------------------
 * 【註解標籤說明】
 *
 * <profitVar:11>
 *   指定要顯示的變數ID
 *
 * <profitText:儲蓄>
 *   指定顯示在前面的文字
 *
 * --------------------------------------------------
 * 【顯示範例】
 *
 * <profitVar:11>
 * <profitText:儲蓄>
 * → 儲蓄:+300
 *
 * <profitVar:12>
 * <profitText:低風險>
 * → 低風險:+100
 *
 * <profitVar:13>
 * <profitText:中風險>
 * → 中風險:-50
 *
 * --------------------------------------------------
 * 【顯示規則】
 * 正數：顯示 +100
 * 負數：顯示 -50
 * 0：依插件參數 showZero 決定是否顯示
 *
 * 若有設定 profitText，格式為：
 * 文字:數值
 *
 * 例如：
 * 儲蓄:+300
 *
 * 若沒設定 profitText，則只顯示數值：
 * +300
 *
 * --------------------------------------------------
 * 【顯示控制開關】
 * 可用插件參數「顯示控制開關ID」控制是否顯示。
 *
 * 例如設成 21：
 * - 開關21 OFF → 不顯示
 * - 開關21 ON  → 顯示
 *
 * 很適合做成：
 * 玩家全部分配完5000元後，才打開開關，
 * 讓所有NPC頭上一起顯示獲利結果。
 *
 * --------------------------------------------------
 * 【注意】
 * 1. 註解請放在事件目前正在使用的事件頁中。
 * 2. 若同一事件頁有多個 <profitVar:x>，只讀第一個。
 * 3. 若同一事件頁有多個 <profitText:xxx>，只讀第一個。
 * 4. 本插件只作用在地圖事件，不作用於玩家。
 */

(() => {
    "use strict";

    const pluginName = "NPCProfitLabel";
    const params = PluginManager.parameters(pluginName);

    const SHOW_SWITCH_ID = Number(params.showSwitchId || 0);
    const FONT_SIZE = Number(params.fontSize || 22);
    const OFFSET_Y = Number(params.offsetY || -65);
    const SHOW_ZERO = String(params.showZero || "false") === "true";
    const TEXT_WIDTH = Number(params.textWidth || 240);

    function extractTagValue(event, regex) {
        if (!event || !event.page()) return "";
        const list = event.list();
        if (!list) return "";

        for (const command of list) {
            if (command.code === 108 || command.code === 408) {
                const text = String(command.parameters[0] || "");
                const match = regex.exec(text);
                if (match) {
                    return match[1];
                }
            }
        }
        return "";
    }

    function extractProfitVarId(event) {
        const value = extractTagValue(event, /<profitVar\s*:\s*(\d+)\s*>/i);
        return value ? Number(value) : 0;
    }

    function extractProfitText(event) {
        return extractTagValue(event, /<profitText\s*:\s*(.+?)\s*>/i);
    }

    function shouldShowProfitLabel() {
        if (SHOW_SWITCH_ID <= 0) return true;
        return $gameSwitches.value(SHOW_SWITCH_ID);
    }

    function formatProfitValue(value) {
        if (value > 0) return `+${value}`;
        if (value < 0) return `${value}`;
        if (SHOW_ZERO) return "0";
        return "";
    }

    function buildDisplayText(label, valueText) {
        if (!valueText) return "";
        if (label && label.trim()) {
            return `${label}:${valueText}`;
        }
        return valueText;
    }

    class Sprite_ProfitLabel extends Sprite {
        initialize(characterSprite) {
            super.initialize();
            this._characterSprite = characterSprite;
            this._event = null;
            this._varId = 0;
            this._labelText = "";
            this._lastText = null;

            this.bitmap = new Bitmap(TEXT_WIDTH, FONT_SIZE + 16);
            this.anchor.x = 0.5;
            this.anchor.y = 1.0;

            this.bitmap.fontSize = FONT_SIZE;
            this.bitmap.outlineWidth = 4;

            this.updateBinding();
            this.update();
        }

        update() {
            super.update();
            this.updateBinding();
            this.updatePosition();
            this.updateText();
            this.updateVisibility();
        }

        updateBinding() {
            const character = this._characterSprite?._character;
            if (character && character instanceof Game_Event) {
                if (this._event !== character) {
                    this._event = character;
                    this.refreshTagSettings();
                } else {
                    const oldVarId = this._varId;
                    const oldLabelText = this._labelText;
                    this.refreshTagSettings();
                    if (oldVarId !== this._varId || oldLabelText !== this._labelText) {
                        this._lastText = null;
                    }
                }
            } else {
                this._event = null;
                this._varId = 0;
                this._labelText = "";
                this._lastText = null;
            }
        }

        refreshTagSettings() {
            this._varId = extractProfitVarId(this._event);
            this._labelText = extractProfitText(this._event);
        }

        updatePosition() {
            if (!this._characterSprite) return;
            this.x = this._characterSprite.x;
            this.y = this._characterSprite.y + OFFSET_Y;
        }

        currentDisplayText() {
            if (!this._varId) return "";
            const value = $gameVariables.value(this._varId);
            const valueText = formatProfitValue(value);
            return buildDisplayText(this._labelText, valueText);
        }

        updateText() {
            const text = this.currentDisplayText();
            if (text !== this._lastText) {
                this._lastText = text;
                this.redraw(text);
            }
        }

        updateVisibility() {
            if (!this._event || !this._varId) {
                this.visible = false;
                return;
            }

            if (!shouldShowProfitLabel()) {
                this.visible = false;
                return;
            }

            const text = this.currentDisplayText();
            this.visible = !!text;
        }

        redraw(text) {
            this.bitmap.clear();
            if (!text) return;

            const value = $gameVariables.value(this._varId);
            this.bitmap.textColor = this.textColorFor(value);
            this.bitmap.drawText(text, 0, 0, this.bitmap.width, this.bitmap.height, "center");
        }

        textColorFor(value) {
            if (value > 0) return "#00ff66";
            if (value < 0) return "#ff6666";
            return "#ffffff";
        }
    }

    const _Spriteset_Map_createCharacters = Spriteset_Map.prototype.createCharacters;
    Spriteset_Map.prototype.createCharacters = function() {
        _Spriteset_Map_createCharacters.call(this);
        this.createProfitLabels();
    };

    Spriteset_Map.prototype.createProfitLabels = function() {
        this._profitLabels = [];

        for (const sprite of this._characterSprites) {
            if (sprite._character instanceof Game_Event) {
                const label = new Sprite_ProfitLabel(sprite);
                this._tilemap.addChild(label);
                this._profitLabels.push(label);
            }
        }
    };

    const _Spriteset_Map_destroy = Spriteset_Map.prototype.destroy;
    Spriteset_Map.prototype.destroy = function(options) {
        if (this._profitLabels) {
            for (const label of this._profitLabels) {
                if (label && label.parent) {
                    label.parent.removeChild(label);
                }
            }
            this._profitLabels = null;
        }
        _Spriteset_Map_destroy.call(this, options);
    };
})();