/*:
 * @target MZ
 * @plugindesc 強制網頁版遊戲自動延展填滿可用空間（適合 iframe / 平板橫向）
 * @author ChatGPT
 */

(() => {
  // 永遠開啟 Stretch Mode
  console.log("ForceStretch 插件已載入");
  Graphics._defaultStretchMode = function() {
    return true;
  };

  const forceResize = () => {
    if (Graphics) {
      Graphics._stretchEnabled = true;
      Graphics._updateRealScale();
      Graphics._updateAllElements();
    }
  };

  const _Scene_Boot_start = Scene_Boot.prototype.start;
  Scene_Boot.prototype.start = function() {
    _Scene_Boot_start.call(this);
    forceResize();
  };

  window.addEventListener("resize", forceResize);
  window.addEventListener("orientationchange", forceResize);

  setTimeout(forceResize, 300);
  setTimeout(forceResize, 1000);
})();