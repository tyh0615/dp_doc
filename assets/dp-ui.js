/* DrissionPage 离线文档 —— 公共 UI 层
 *
 * 一、四个 Web 组件（均为 open shadow DOM，用 <slot> 接收各页差异化内容）
 *
 *   <dp-sidebar active="<slug>">   左侧全局导航：品牌区 + 筛选框 + 导航树
 *       默认插槽          追加的自定义侧栏区块（排在导航树之后、footer 之前）
 *       具名 slot=footer  侧栏底部区块
 *
 *   <dp-topbar>                    顶部工具条：面包屑 + 全文搜索 + 主题切换
 *       默认插槽          追加的工具栏元素（排在搜索框之后、主题按钮之前）
 *       具名 slot=crumb   本页面包屑（各页唯一差异，由页面提供）
 *
 *   <dp-toc>                       右栏本页目录 + 回到顶部按钮
 *       默认插槽          本页目录列表（<ul class="toc-list">，各页唯一差异）
 *       具名 slot=footer  目录下方的额外内容
 *
 *   <dp-pager>                     上一页 / 下一页
 *       具名 slot=prev / slot=next   两端链接，各页不同
 *       无默认插槽：两端语义固定，缺链接时由 slot fallback 自动补占位
 *
 * 二、正文增强：给每个代码块挂「复制」按钮（作用在 light DOM 的 article 上）。
 *
 * 样式归属（重要）：
 *   - 组件外壳（.sidebar/.brand/.nav/.topbar/.search-wrap/.results/.toc-title/
 *     .pager 等）只存在于 shadow 树里，样式写在下面的 SHELL_CSS，随组件走。
 *   - 通过插槽传入的正文式内容（.crumb / .toc-list / .pager-link）留在 light DOM，
 *     样式仍由 style.css 负责；组件自带的按钮用 part="btn" 交给 style.css 的 .btn。
 *   任何一条规则都只有一份，不会出现两套样式互相覆盖。
 *
 * 依赖：assets/search-index.js 必须先于本文件加载（window.DP_SEARCH 既作搜索索引，
 *       也作导航数据源，字段 t=标题 s=slug g=分组 u=子分组）。
 */
(function () {
    'use strict';

    if (!window.customElements) { return; }

    /* ================================================================ 基础 */

    var THEME_KEY = 'dp-doc-theme';
    var ROOT = document.documentElement;

    /* 页面相对站点根的前缀：首页 ''，pages/ 下 '../'，由 <body data-prefix> 给出。
       本文件在 head 里执行时 body 还不存在，所以要等组件连接时再读。 */
    function prefix() {
        return (document.body && document.body.getAttribute('data-prefix')) || '';
    }

    function pageHref(slug) { return prefix() + 'pages/' + slug + '.html'; }

    function pad2(n) { return (n < 10 ? '0' : '') + n; }

    function node(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) { n.className = cls; }
        if (text !== undefined && text !== null) { n.textContent = text; }
        return n;
    }

    /* 同一份页面清单同时驱动侧栏与搜索，不必再维护一个导航数据文件 */
    function allPages() { return window.DP_SEARCH || []; }

    /* ------------------------------------------------------------- 主题 */

    var themePainters = [];

    function applyTheme(name) {
        ROOT.setAttribute('data-theme', name);
        try { localStorage.setItem(THEME_KEY, name); } catch (e) { /* 隐私模式忽略 */ }
        for (var i = 0; i < themePainters.length; i++) { themePainters[i](name); }
    }

    (function () {
        var saved = null;
        try { saved = localStorage.getItem(THEME_KEY); } catch (e) { saved = null; }
        if (saved === 'dark' || saved === 'light') { ROOT.setAttribute('data-theme', saved); }
    })();

    /* ------------------------------------------------- 组件共用样式表 ----
       构造式样式表解析一次、所有组件实例共享；老内核退回每个 shadow 塞一个
       <style>。SHELL_CSS 里只用 :host(标签名) 限定，防止四个组件互相误伤。 */

    var SHELL_CSS = `
/* -------------------------------------------------------- dp-sidebar -- */
:host(dp-sidebar){
  display:block;flex:0 0 290px;position:sticky;top:0;height:100vh;
  overflow-y:auto;border-right:1px solid var(--line);background:var(--bg-soft)
}
.sidebar{padding:14px 12px 40px}
.brand{font-weight:700;font-size:15px;padding:6px 8px 2px;color:var(--fg)}
.brand small{display:block;font-weight:400;color:var(--fg-soft);font-size:12px;margin-top:2px}
.filter{
  width:100%;margin:10px 0 8px;padding:7px 10px;border:1px solid var(--line);
  border-radius:var(--radius);background:var(--bg);color:var(--fg);outline:none
}
.filter:focus{border-color:var(--accent)}
.nav{list-style:none;margin:0;padding:0}
.nav li{margin:1px 0}
.nav a{display:block;padding:5px 9px;border-radius:6px;color:var(--fg);font-size:13.5px}
.nav a:hover{background:var(--accent-soft);text-decoration:none}
.nav a.active{background:var(--accent);color:#fff;font-weight:600}
.nav a .idx{display:inline-block;min-width:20px;color:var(--fg-soft);font-variant-numeric:tabular-nums}
.nav a.active .idx{color:#fff}
.nav-group{
  margin:14px 0 4px;padding:4px 9px 2px;font-size:12px;font-weight:700;
  color:var(--fg-soft);letter-spacing:.4px;border-top:1px solid var(--line);padding-top:10px
}
.nav-group:first-child{border-top:0;padding-top:2px;margin-top:2px}
.nav-sub{margin:8px 0 2px;padding:2px 9px;font-size:11.5px;color:var(--fg-soft);opacity:.85}

/* --------------------------------------------------------- dp-topbar -- */
:host(dp-topbar){display:block;position:sticky;top:0;z-index:5}
.topbar{
  display:flex;align-items:center;gap:10px;padding:10px 26px;
  border-bottom:1px solid var(--line);background:var(--bg)
}
.crumb-box{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.search-wrap{position:relative;flex:0 0 260px;margin-right:1em;}
.search-wrap input{
  width:100%;padding:6px 10px;border:1px solid var(--line);
  border-radius:var(--radius);background:var(--bg);color:var(--fg);outline:none;font-size:13px
}
.search-wrap input:focus{border-color:var(--accent)}
.results{
  position:absolute;top:110%;left:0;right:0;max-height:60vh;overflow:auto;
  background:var(--bg);border:1px solid var(--line);border-radius:var(--radius);
  box-shadow:0 8px 24px rgba(0,0,0,.18);display:none;z-index:20
}
.results.on{display:block}
.results a{
  display:block;padding:7px 11px;color:var(--fg);
  border-bottom:1px solid var(--line);font-size:13px
}
.results a:last-child{border-bottom:0}
.results a:hover{background:var(--accent-soft);text-decoration:none}
.results .r-page{color:var(--fg-soft);font-size:11.5px;display:block}

/* ------------------------------------------------------------ dp-toc -- */
:host(dp-toc){
  display:block;flex:0 0 210px;position:sticky;top:70px;
  max-height:calc(100vh - 90px);overflow-y:auto;font-size:12.8px;
  border-left:1px solid var(--line);padding-left:14px
}
.toc-title{font-weight:600;color:var(--fg-soft);margin-bottom:8px;font-size:12.5px}
.toc-foot{margin-top:14px}
.toc-foot .btn{width:100%}

/* ---------------------------------------------------------- dp-pager -- */
:host(dp-pager){display:block}
.pager{
  display:flex;justify-content:space-between;gap:14px;
  margin:40px 0 0;padding-top:18px;border-top:1px solid var(--line)
}
.pager .ph{flex:1}

@media (max-width:1080px){
  :host(dp-toc){display:none}
}
@media (max-width:820px){
  :host(dp-sidebar){display:none}
  .topbar{padding:9px 14px}
}
`;

    var SHEET;

    function sharedSheet() {
        if (SHEET !== undefined) { return SHEET; }
        SHEET = null;
        try {
            var s = new CSSStyleSheet();
            s.replaceSync(SHELL_CSS);
            SHEET = s;
        } catch (e) { SHEET = null; }
        return SHEET;
    }

    function openShadow(host, html) {
        var sr = host.attachShadow({ mode: 'open' });
        sr.innerHTML = html;
        var sheet = sharedSheet();
        if (sheet) {
            sr.adoptedStyleSheets = [sheet];
        } else {
            sr.appendChild(node('style')).textContent = SHELL_CSS;
        }
        return sr;
    }

    /* 模板字符串只写一次；子类通过静态属性引用 */
    var TPL = {
        sidebar: `<aside class="sidebar">
<div class="brand">DrissionPage 文档<small>离线版</small></div>
<input class="filter" id="navFilter" type="text" placeholder="筛选章节..." aria-label="筛选章节">
<ul class="nav" id="navList"></ul>
<slot></slot>
<slot name="footer"></slot>
</aside>`,

        topbar: `<div class="topbar">
<div class="crumb-box"><slot name="crumb"></slot></div>
<div class="search-wrap">
<input id="searchInput" type="text" placeholder="搜索全文标题 (Ctrl+K 聚焦)" aria-label="搜索文档">
<div class="results" id="searchResults"></div>
</div>
<slot></slot>
<button class="btn" part="btn" id="themeBtn" type="button">深色</button>
</div>`,

        toc: `<nav class="toc">
<div class="toc-title"><slot name="title">本页内容</slot></div>
<slot></slot>
<div class="toc-foot"><slot name="footer"></slot><button class="btn" part="btn" id="topBtn" type="button">回到顶部</button></div>
</nav>`,

        pager: `<div class="pager">
<slot name="prev"><span class="ph"></span></slot>
<slot name="next"><span class="ph"></span></slot>
</div>`
    };

    /* 一个元素被移动会导致 connectedCallback 重入，只渲染一次 */
    function renderOnce(el, key, fn) {
        if (el[key]) { return; }
        el[key] = true;
        fn();
    }

    /* ======================================================= 组件定义 */

    class DpSidebar extends HTMLElement {
        connectedCallback() {
            renderOnce(this, '_dpReady', () => {
                const sr = openShadow(this, TPL.sidebar);
                this._aside = sr.querySelector('.sidebar');
                this._list = sr.getElementById('navList');
                this._buildNav();
                sr.getElementById('navFilter').addEventListener('input', (e) => {
                    this._filter(e.target.value);
                });
            });
        }

        /* 导航树完全由页面清单生成，页面自身不再携带 46 条 <li> */
        _buildNav() {
            const ul = this._list;
            const active = this.getAttribute('active') || '';
            const list = allPages();
            console.log(' list => ', list)
            let group, sub;
            ul.textContent = '';
            for (let i = 0; i < list.length; i++) {
                const p = list[i];
                if (p.g !== group) {
                    group = p.g || '';
                    sub = null;
                    ul.appendChild(node('li', 'nav-group', group));
                }
                if (p.u && p.u !== sub) {
                    sub = p.u;
                    ul.appendChild(node('li', 'nav-sub', '\u25B8 ' + sub));
                }
                const a = node('a');
                a.href = pageHref(p.s);
                if (p.s === active) { a.className = 'active'; }
                a.appendChild(node('span', 'idx', pad2(i + 1)));
                a.appendChild(document.createTextNode(p.t));
                const li = node('li');
                li.appendChild(a);
                ul.appendChild(li);
            }
        }

        _filter(value) {
            const q = String(value || '').trim().toLowerCase();
            const lis = this._list.querySelectorAll('li');
            for (let i = 0; i < lis.length; i++) {
                lis[i].style.display =
                    (!q || lis[i].textContent.toLowerCase().indexOf(q) >= 0) ? '' : 'none';
            }
        }
    }

    class DpTopbar extends HTMLElement {
        connectedCallback() {
            renderOnce(this, '_dpReady', () => {
                const sr = openShadow(this, TPL.topbar);
                this._initTheme(sr);
                this._initSearch(sr);
            });
        }

        _initTheme(sr) {
            const btn = sr.getElementById('themeBtn');
            const paint = (name) => { btn.textContent = name === 'dark' ? '浅色' : '深色'; };
            paint(ROOT.getAttribute('data-theme'));
            themePainters.push(paint);
            btn.addEventListener('click', () => {
                applyTheme(ROOT.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
            });
        }

        _initSearch(sr) {
            const box = sr.getElementById('searchInput');
            const panel = sr.getElementById('searchResults');
            if (!box || !panel) { return; }

            const PREFIX = prefix();
            const close = () => panel.classList.remove('on');

            const render = (q) => {
                q = String(q || '').trim().toLowerCase();
                panel.textContent = '';
                if (!q) { close(); return; }
                const hits = [];
                const list = allPages();
                for (let i = 0; i < list.length; i++) {
                    const p = list[i];
                    const src = p.g ? p.g + ' / ' + p.t : p.t;
                    if (p.t.toLowerCase().indexOf(q) >= 0) {
                        hits.push({ url: PREFIX + 'pages/' + p.s + '.html', t: p.t, s: src });
                    }
                    for (let j = 0; j < p.h.length; j++) {
                        const h = p.h[j];
                        if (h[1].toLowerCase().indexOf(q) >= 0) {
                            hits.push({
                                url: PREFIX + 'pages/' + p.s + '.html#' + h[0],
                                t: h[1], s: src
                            });
                        }
                    }
                    if (hits.length > 60) { break; }
                }
                if (!hits.length) {
                    panel.appendChild(node('a', null, '无匹配结果'));
                    panel.classList.add('on');
                    return;
                }
                hits.slice(0, 40).forEach((x) => {
                    const a = node('a');
                    a.href = x.url;
                    a.appendChild(document.createTextNode(x.t));
                    a.appendChild(node('span', 'r-page', x.s));
                    panel.appendChild(a);
                });
                panel.classList.add('on');
            };

            box.addEventListener('input', () => render(box.value));
            box.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') { close(); box.blur(); }
            });
            /* 组件在 shadow 里，document 收到的 e.target 会被重定向成宿主元素，
               必须用 composedPath 才能判断点击是否落在输入框 / 结果面板上 */
            document.addEventListener('click', (e) => {
                const path = e.composedPath ? e.composedPath() : [];
                if (path.indexOf(panel) < 0 && path.indexOf(box) < 0) { close(); }
            });
        }
    }

    class DpToc extends HTMLElement {
        connectedCallback() {
            renderOnce(this, '_dpReady', () => {
                const sr = openShadow(this, TPL.toc);
                sr.getElementById('topBtn').addEventListener('click', () => {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                });
            });
        }
    }

    class DpPager extends HTMLElement {
        connectedCallback() {
            renderOnce(this, '_dpReady', () => { openShadow(this, TPL.pager); });
        }
    }

    function register(name, ctor) {
        if (!customElements.get(name)) { customElements.define(name, ctor); }
    }

    register('dp-sidebar', DpSidebar);
    register('dp-topbar', DpTopbar);
    register('dp-toc', DpToc);
    register('dp-pager', DpPager);

    /* ============================================ 正文：代码块复制按钮 ---- */

    function setupCopyButtons() {
        /* 取文本用 clone + 把 <br> 换成换行，比 pre.innerText 稳：
           不依赖渲染布局，缩进与空行都按 DOM 原样来。 */
        function codeText(pre) {
            const c = pre.cloneNode(true);
            Array.prototype.forEach.call(c.querySelectorAll('br'), (b) => {
                b.parentNode.replaceChild(document.createTextNode('\n'), b);
            });
            return (c.textContent || '').replace(/\u200b/g, '').replace(/\s+$/, '');
        }

        function flash(btn) {
            btn.textContent = '已复制';
            btn.classList.add('done');
            clearTimeout(btn._timer);
            btn._timer = setTimeout(() => {
                btn.textContent = '复制';
                btn.classList.remove('done');
            }, 1500);
        }

        /* file:// 下部分浏览器不给 navigator.clipboard，留一条 execCommand 退路 */
        function legacyCopy(text) {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.setAttribute('readonly', '');
            ta.style.cssText = 'position:fixed;top:-2000px;left:-2000px;opacity:0';
            document.body.appendChild(ta);
            ta.select();
            ta.setSelectionRange(0, text.length);
            let ok = false;
            try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
            document.body.removeChild(ta);
            return ok;
        }

        Array.prototype.forEach.call(document.querySelectorAll('article pre'), (pre) => {
            let host = pre.closest('.theme-code-block') || pre.parentElement;
            if (!host) { return; }
            if (host.tagName === 'PRE') {
                host = document.createElement('div');
                pre.parentNode.insertBefore(host, pre);
                host.appendChild(pre);
            }
            host.classList.add('dp-code');
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'copy-btn';
            btn.textContent = '复制';
            btn.title = '复制这段代码';
            btn.setAttribute('aria-label', '复制代码块内容');
            btn.addEventListener('click', () => {
                const text = codeText(pre);
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text).then(() => flash(btn),
                        () => { if (legacyCopy(text)) { flash(btn); } });
                } else if (legacyCopy(text)) {
                    flash(btn);
                }
            });
            host.appendChild(btn);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupCopyButtons);
    } else {
        setupCopyButtons();
    }
})();
