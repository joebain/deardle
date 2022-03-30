
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    let src_url_equal_anchor;
    function src_url_equal(element_src, url) {
        if (!src_url_equal_anchor) {
            src_url_equal_anchor = document.createElement('a');
        }
        src_url_equal_anchor.href = url;
        return element_src === src_url_equal_anchor.href;
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function validate_store(store, name) {
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        if (value === null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
    }
    // unfortunately this can't be a constant as that wouldn't be tree-shakeable
    // so we cache the result instead
    let crossorigin;
    function is_crossorigin() {
        if (crossorigin === undefined) {
            crossorigin = false;
            try {
                if (typeof window !== 'undefined' && window.parent) {
                    void window.parent.document;
                }
            }
            catch (error) {
                crossorigin = true;
            }
        }
        return crossorigin;
    }
    function add_resize_listener(node, fn) {
        const computed_style = getComputedStyle(node);
        if (computed_style.position === 'static') {
            node.style.position = 'relative';
        }
        const iframe = element('iframe');
        iframe.setAttribute('style', 'display: block; position: absolute; top: 0; left: 0; width: 100%; height: 100%; ' +
            'overflow: hidden; border: 0; opacity: 0; pointer-events: none; z-index: -1;');
        iframe.setAttribute('aria-hidden', 'true');
        iframe.tabIndex = -1;
        const crossorigin = is_crossorigin();
        let unsubscribe;
        if (crossorigin) {
            iframe.src = "data:text/html,<script>onresize=function(){parent.postMessage(0,'*')}</script>";
            unsubscribe = listen(window, 'message', (event) => {
                if (event.source === iframe.contentWindow)
                    fn();
            });
        }
        else {
            iframe.src = 'about:blank';
            iframe.onload = () => {
                unsubscribe = listen(iframe.contentWindow, 'resize', fn);
            };
        }
        append(node, iframe);
        return () => {
            if (crossorigin) {
                unsubscribe();
            }
            else if (unsubscribe && iframe.contentWindow) {
                unsubscribe();
            }
            detach(iframe);
        };
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function tick() {
        schedule_update();
        return resolved_promise;
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.46.4' }, detail), true));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    function createCommonjsModule(fn) {
      var module = { exports: {} };
    	return fn(module, module.exports), module.exports;
    }

    var autoComplete_min = createCommonjsModule(function (module, exports) {
    var e;e=function(){function t(t,e){var n=Object.keys(t);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(t);e&&(r=r.filter((function(e){return Object.getOwnPropertyDescriptor(t,e).enumerable}))),n.push.apply(n,r);}return n}function e(e){for(var n=1;n<arguments.length;n++){var i=null!=arguments[n]?arguments[n]:{};n%2?t(Object(i),!0).forEach((function(t){r(e,t,i[t]);})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(i)):t(Object(i)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(i,t));}));}return e}function n(t){return (n="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t})(t)}function r(t,e,n){return e in t?Object.defineProperty(t,e,{value:n,enumerable:!0,configurable:!0,writable:!0}):t[e]=n,t}function i(t){return function(t){if(Array.isArray(t))return s(t)}(t)||function(t){if("undefined"!=typeof Symbol&&null!=t[Symbol.iterator]||null!=t["@@iterator"])return Array.from(t)}(t)||o(t)||function(){throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}function o(t,e){if(t){if("string"==typeof t)return s(t,e);var n=Object.prototype.toString.call(t).slice(8,-1);return "Object"===n&&t.constructor&&(n=t.constructor.name),"Map"===n||"Set"===n?Array.from(t):"Arguments"===n||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)?s(t,e):void 0}}function s(t,e){(null==e||e>t.length)&&(e=t.length);for(var n=0,r=new Array(e);n<e;n++)r[n]=t[n];return r}var u=function(t){return "string"==typeof t?document.querySelector(t):t()},a=function(t,e){var n="string"==typeof t?document.createElement(t):t;for(var r in e){var i=e[r];if("inside"===r)i.append(n);else if("dest"===r)u(i[0]).insertAdjacentElement(i[1],n);else if("around"===r){var o=i;o.parentNode.insertBefore(n,o),n.append(o),null!=o.getAttribute("autofocus")&&o.focus();}else r in n?n[r]=i:n.setAttribute(r,i);}return n},c=function(t,e){return t=t.toString().toLowerCase(),e?t.normalize("NFD").replace(/[\u0300-\u036f]/g,"").normalize("NFC"):t},l=function(t,n){return a("mark",e({innerHTML:t},"string"==typeof n&&{class:n})).outerHTML},f=function(t,e){e.input.dispatchEvent(new CustomEvent(t,{bubbles:!0,detail:e.feedback,cancelable:!0}));},p=function(t,e,n){var r=n||{},i=r.mode,o=r.diacritics,s=r.highlight,u=c(e,o);if(e=e.toString(),t=c(t,o),"loose"===i){var a=(t=t.replace(/ /g,"")).length,f=0,p=Array.from(e).map((function(e,n){return f<a&&u[n]===t[f]&&(e=s?l(e,s):e,f++),e})).join("");if(f===a)return p}else {var d=u.indexOf(t);if(~d)return t=e.substring(d,d+t.length),d=s?e.replace(t,l(t,s)):e}},d=function(t,e){return new Promise((function(n,r){var i;return (i=t.data).cache&&i.store?n():new Promise((function(t,n){return "function"==typeof i.src?i.src(e).then(t,n):t(i.src)})).then((function(e){try{return t.feedback=i.store=e,f("response",t),n()}catch(t){return r(t)}}),r)}))},h=function(t,e){var n=e.data,r=e.searchEngine,i=[];n.store.forEach((function(s,u){var a=function(n){var o=n?s[n]:s,u="function"==typeof r?r(t,o):p(t,o,{mode:r,diacritics:e.diacritics,highlight:e.resultItem.highlight});if(u){var a={match:u,value:s};n&&(a.key=n),i.push(a);}};if(n.keys){var c,l=function(t,e){var n="undefined"!=typeof Symbol&&t[Symbol.iterator]||t["@@iterator"];if(!n){if(Array.isArray(t)||(n=o(t))||e&&t&&"number"==typeof t.length){n&&(t=n);var r=0,i=function(){};return {s:i,n:function(){return r>=t.length?{done:!0}:{done:!1,value:t[r++]}},e:function(t){throw t},f:i}}throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}var s,u=!0,a=!1;return {s:function(){n=n.call(t);},n:function(){var t=n.next();return u=t.done,t},e:function(t){a=!0,s=t;},f:function(){try{u||null==n.return||n.return();}finally{if(a)throw s}}}}(n.keys);try{for(l.s();!(c=l.n()).done;)a(c.value);}catch(t){l.e(t);}finally{l.f();}}else a();})),n.filter&&(i=n.filter(i));var s=i.slice(0,e.resultsList.maxResults);e.feedback={query:t,matches:i,results:s},f("results",e);},m="aria-expanded",b="aria-activedescendant",y="aria-selected",v=function(t,n){t.feedback.selection=e({index:n},t.feedback.results[n]);},g=function(t){t.isOpen||((t.wrapper||t.input).setAttribute(m,!0),t.list.removeAttribute("hidden"),t.isOpen=!0,f("open",t));},w=function(t){t.isOpen&&((t.wrapper||t.input).setAttribute(m,!1),t.input.setAttribute(b,""),t.list.setAttribute("hidden",""),t.isOpen=!1,f("close",t));},O=function(t,e){var n=e.resultItem,r=e.list.getElementsByTagName(n.tag),o=!!n.selected&&n.selected.split(" ");if(e.isOpen&&r.length){var s,u,a=e.cursor;t>=r.length&&(t=0),t<0&&(t=r.length-1),e.cursor=t,a>-1&&(r[a].removeAttribute(y),o&&(u=r[a].classList).remove.apply(u,i(o))),r[t].setAttribute(y,!0),o&&(s=r[t].classList).add.apply(s,i(o)),e.input.setAttribute(b,r[e.cursor].id),e.list.scrollTop=r[t].offsetTop-e.list.clientHeight+r[t].clientHeight+5,e.feedback.cursor=e.cursor,v(e,t),f("navigate",e);}},A=function(t){O(t.cursor+1,t);},k=function(t){O(t.cursor-1,t);},L=function(t,e,n){(n=n>=0?n:t.cursor)<0||(t.feedback.event=e,v(t,n),f("selection",t),w(t));};function j(t,n){var r=this;return new Promise((function(i,o){var s,u;return s=n||((u=t.input)instanceof HTMLInputElement||u instanceof HTMLTextAreaElement?u.value:u.innerHTML),function(t,e,n){return e?e(t):t.length>=n}(s=t.query?t.query(s):s,t.trigger,t.threshold)?d(t,s).then((function(n){try{return t.feedback instanceof Error?i():(h(s,t),t.resultsList&&function(t){var n=t.resultsList,r=t.list,i=t.resultItem,o=t.feedback,s=o.matches,u=o.results;if(t.cursor=-1,r.innerHTML="",s.length||n.noResults){var c=new DocumentFragment;u.forEach((function(t,n){var r=a(i.tag,e({id:"".concat(i.id,"_").concat(n),role:"option",innerHTML:t.match,inside:c},i.class&&{class:i.class}));i.element&&i.element(r,t);})),r.append(c),n.element&&n.element(r,o),g(t);}else w(t);}(t),c.call(r))}catch(t){return o(t)}}),o):(w(t),c.call(r));function c(){return i()}}))}var S=function(t,e){for(var n in t)for(var r in t[n])e(n,r);},T=function(t){var n,r,i,o=t.events,s=(n=function(){return j(t)},r=t.debounce,function(){clearTimeout(i),i=setTimeout((function(){return n()}),r);}),u=t.events=e({input:e({},o&&o.input)},t.resultsList&&{list:o?e({},o.list):{}}),a={input:{input:function(){s();},keydown:function(e){!function(t,e){switch(t.keyCode){case 40:case 38:t.preventDefault(),40===t.keyCode?A(e):k(e);break;case 13:e.submit||t.preventDefault(),e.cursor>=0&&L(e,t);break;case 9:e.resultsList.tabSelect&&e.cursor>=0&&L(e,t);break;case 27:e.input.value="",w(e);}}(e,t);},blur:function(){w(t);}},list:{mousedown:function(t){t.preventDefault();},click:function(e){!function(t,e){var n=e.resultItem.tag.toUpperCase(),r=Array.from(e.list.querySelectorAll(n)),i=t.target.closest(n);i&&i.nodeName===n&&L(e,t,r.indexOf(i));}(e,t);}}};S(a,(function(e,n){(t.resultsList||"input"===n)&&(u[e][n]||(u[e][n]=a[e][n]));})),S(u,(function(e,n){t[e].addEventListener(n,u[e][n]);}));};function E(t){var n=this;return new Promise((function(r,i){var o,s,u;if(o=t.placeHolder,u={role:"combobox","aria-owns":(s=t.resultsList).id,"aria-haspopup":!0,"aria-expanded":!1},a(t.input,e(e({"aria-controls":s.id,"aria-autocomplete":"both"},o&&{placeholder:o}),!t.wrapper&&e({},u))),t.wrapper&&(t.wrapper=a("div",e({around:t.input,class:t.name+"_wrapper"},u))),s&&(t.list=a(s.tag,e({dest:[s.destination,s.position],id:s.id,role:"listbox",hidden:"hidden"},s.class&&{class:s.class}))),T(t),t.data.cache)return d(t).then((function(t){try{return c.call(n)}catch(t){return i(t)}}),i);function c(){return f("init",t),r()}return c.call(n)}))}function x(t){var e=t.prototype;e.init=function(){E(this);},e.start=function(t){j(this,t);},e.unInit=function(){if(this.wrapper){var t=this.wrapper.parentNode;t.insertBefore(this.input,this.wrapper),t.removeChild(this.wrapper);}var e;S((e=this).events,(function(t,n){e[t].removeEventListener(n,e.events[t][n]);}));},e.open=function(){g(this);},e.close=function(){w(this);},e.goTo=function(t){O(t,this);},e.next=function(){A(this);},e.previous=function(){k(this);},e.select=function(t){L(this,null,t);},e.search=function(t,e,n){return p(t,e,n)};}return function t(e){this.options=e,this.id=t.instances=(t.instances||0)+1,this.name="autoComplete",this.wrapper=1,this.threshold=1,this.debounce=0,this.resultsList={position:"afterend",tag:"ul",maxResults:5},this.resultItem={tag:"li"},function(t){var e=t.name,r=t.options,i=t.resultsList,o=t.resultItem;for(var s in r)if("object"===n(r[s]))for(var a in t[s]||(t[s]={}),r[s])t[s][a]=r[s][a];else t[s]=r[s];t.selector=t.selector||"#"+e,i.destination=i.destination||t.selector,i.id=i.id||e+"_list_"+t.id,o.id=o.id||e+"_result",t.input=u(t.selector);}(this),x.call(this,t),E(this);}},module.exports=e();
    });

    const genAC = (selectorElem) => {
        let ac = new autoComplete_min({
            data: {
                src: [
                    { id: 1, name: "one" },
                    { id: 2, name: "two" },
                    { id: 3, name: "three" },
                    { id: 4, name: "èèèat" },
                    { id: 5, name: "thrèèè" },
                    { id: 6, name: "song1" },
                ],
                cache: true,
                keys: ["name"],
            },
            resultItem: {
                highlight: true,
                class: ""
            },
            events: {
                input: {
                    selection: (event) => {
                        ac.lastSelectedVal = event.detail.selection.value.name;
                        ac.input.value = ac.lastSelectedVal;
                    },  
                },
            },
            selector: () => selectorElem,
            resultsList: {
                element: (list, data) => {
                    if (!data.results.length) {
                        const message = document.createElement("div");
                        message.setAttribute("class", "no_result");
                        message.innerHTML = `<span>Found No Results for "${data.query}"</span>`;
                        list.prepend(message);
                    }
                },
                noResults: true,
                class: "border bg-black relative mx-[-1px]"
            },
            threshold: 3,
            searchEngine: "loose",
            diacritics: true,
            submit: true,
        });
        return ac;
    };

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    function getSOTD() {
        return { name: "song1", url: "https://soundcloud.com/linkin_park/numb" }
    }
    const SOTD = getSOTD();

    function getStoreVal(store) {
        let val;
        store.subscribe(value => val = value)();
        return val;
    }

    const info = {
        maxPos: writable(1*1000),
        cPos: writable(0),
        playing: writable(false),
        resetOnPlay: writable(true),
        wid: undefined,
        nextMax() {
            switch (getStoreVal(this.maxPos)) {
                case 1000: 
                    return 2000;
                case 2000:
                    return 4000;
                case 4000:
                    return 7000;
                case 7000:
                    return 11000;
                case 11000:
                    return 16000;
                default:
                    return 16000;
            }
        }
    };


    // function T() {
    //     let scWid = SC.Widget("soundcloud" + h.id);
    //     scWid.bind(SC.Widget.Events.READY, function () {
    //         y.getCurrentSound(function (e) {
    //             "BLOCK" === e.policy && n(9, (g = !0)), c("updateSong", { currentSong: e });
    //         }),
    //             y.bind(SC.Widget.Events.PAUSE, function () {
    //                 $(!1);
    //             }),
    //             y.bind(SC.Widget.Events.PLAY, function () {
    //                 b || (pe("startGame", { name: "startGame" }), pe("startGame#" + h.id, { name: "startGame" }), (b = !0)), $(!0), n(12, (x = !0));
    //             }),
    //             y.bind(SC.Widget.Events.PLAY_PROGRESS, function (e) {
    //                 n(11, (w = e.currentPosition)),
    //                     1 == s ? (p.isPrime ? (n(10, (v = (w / u) * 100)), w > u && M()) : (n(10, (v = (w / (d * f.attemptInterval)) * 100)), w > d * f.attemptInterval && M())) : (n(10, (v = (w / m) * 100)), w > m && M());
    //             });
    //     });
    // }

    // P(() => {
    //     const e = document.createElement("iframe");
    //     (e.name = h.id),
    //         (e.id = "soundcloud" + h.id),
    //         (e.allow = "autoplay"),
    //         (e.height = 0),
    //         (e.src = "https://w.soundcloud.com/player/?url=" + h.url + "&cache=" + h.id),
    //         D.appendChild(e),
    //         (_ = !0),
    //         k &&
    //             (setTimeout(() => {
    //                 n(13, (S = !0));
    //             }, 6e3),
    //             T());
    // });

    // y.toggle()
    // y.seekTo(0), y.play();

    const fields = writable(makeFields());

    function makeFields() {
        let self = Array.from({ length: 6 }, Object);
        self.i = 0;
        self.current = self[self.i];

        self.end = () => {
            self.current = null;
        };
        self.next = () => {
            self.i++;
            if (self.i == 6) {
                self.end();
                info.maxPos.set(10*60*1000);
                info.wid.play();
            } else {
                self.current = self[self.i];
                tick().then(() => self.current.elem.focus());
                info.maxPos.set(info.nextMax());
                info.resetOnPlay.set(false);
            }
        };
        self.skip = () => {
            self.current.class = "skipped";
            self.current.val = "SKIPPED";
            self.next();
            fields.update((o) => o);
        };

        self.submit = () => {
            self.current.val = self.current.elem.value; // svelte why do I need to do this
            if (!self.current.ac || self.current.val === self.current.ac.lastSelectedVal) {
                if (self.current.val == SOTD.name) {
                    self.current.class = "correct";
                    self.end();
                } else {
                    self.current.class = "incorrect";
                    self.next();
                }
                fields.update((o) => o);
            }
        };
        return self;
    }

    /* src\Fields.svelte generated by Svelte v3.46.4 */
    const file$4 = "src\\Fields.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[4] = list[i];
    	child_ctx[5] = list;
    	child_ctx[6] = i;
    	return child_ctx;
    }

    // (27:0) {#each $fields as field}
    function create_each_block(ctx) {
    	let div;
    	let input;
    	let input_disabled_value;
    	let input_class_value;
    	let input_placeholder_value;
    	let each_value = /*each_value*/ ctx[5];
    	let field_index = /*field_index*/ ctx[6];
    	let t;
    	let mounted;
    	let dispose;
    	const assign_input = () => /*input_binding*/ ctx[2](input, each_value, field_index);
    	const unassign_input = () => /*input_binding*/ ctx[2](null, each_value, field_index);

    	function input_input_handler() {
    		/*input_input_handler*/ ctx[3].call(input, /*each_value*/ ctx[5], /*field_index*/ ctx[6]);
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			input = element("input");
    			t = space();
    			input.disabled = input_disabled_value = /*field*/ ctx[4] !== /*$fields*/ ctx[0].current;

    			attr_dev(input, "class", input_class_value = "" + ((/*field*/ ctx[4].class
    			? /*field*/ ctx[4].class
    			: "bg-transparent") + " border focus:outline outline-2 outline-white placeholder:text-neutral-200 select-none p-1.5 text-xl w-full" + " svelte-1pz73f6"));

    			attr_dev(input, "id", "guessfield");

    			attr_dev(input, "placeholder", input_placeholder_value = /*field*/ ctx[4] === /*$fields*/ ctx[0].current
    			? "Start typing..."
    			: "");

    			add_location(input, file$4, 28, 1, 587);
    			attr_dev(div, "class", "bg-gradient-to-r from-primary2-500/30 to-secondary2-500/30 w-full h-10 my-2");
    			add_location(div, file$4, 27, 0, 495);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, input);
    			assign_input();
    			set_input_value(input, /*field*/ ctx[4].val);
    			append_dev(div, t);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", input_input_handler),
    					listen_dev(input, "keydown", /*kd*/ ctx[1], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty & /*$fields*/ 1 && input_disabled_value !== (input_disabled_value = /*field*/ ctx[4] !== /*$fields*/ ctx[0].current)) {
    				prop_dev(input, "disabled", input_disabled_value);
    			}

    			if (dirty & /*$fields*/ 1 && input_class_value !== (input_class_value = "" + ((/*field*/ ctx[4].class
    			? /*field*/ ctx[4].class
    			: "bg-transparent") + " border focus:outline outline-2 outline-white placeholder:text-neutral-200 select-none p-1.5 text-xl w-full" + " svelte-1pz73f6"))) {
    				attr_dev(input, "class", input_class_value);
    			}

    			if (dirty & /*$fields*/ 1 && input_placeholder_value !== (input_placeholder_value = /*field*/ ctx[4] === /*$fields*/ ctx[0].current
    			? "Start typing..."
    			: "")) {
    				attr_dev(input, "placeholder", input_placeholder_value);
    			}

    			if (each_value !== /*each_value*/ ctx[5] || field_index !== /*field_index*/ ctx[6]) {
    				unassign_input();
    				each_value = /*each_value*/ ctx[5];
    				field_index = /*field_index*/ ctx[6];
    				assign_input();
    			}

    			if (dirty & /*$fields*/ 1 && input.value !== /*field*/ ctx[4].val) {
    				set_input_value(input, /*field*/ ctx[4].val);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			unassign_input();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(27:0) {#each $fields as field}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let each_1_anchor;
    	let each_value = /*$fields*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*$fields, kd*/ 3) {
    				each_value = /*$fields*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let $fields;
    	validate_store(fields, 'fields');
    	component_subscribe($$self, fields, $$value => $$invalidate(0, $fields = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Fields', slots, []);

    	onMount(() => {
    		for (let f of $fields) {
    			f.ac = genAC(f.elem);
    		}

    		$fields.current.elem.focus();
    	});

    	function kd(e) {
    		if (e.key === "Enter") {
    			$fields.submit();
    		} else if (e.key === "Tab") {
    			try {
    				$fields.current.ac.select();
    			} catch {
    				
    			}
    		} else {
    			return;
    		}

    		e.preventDefault();
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Fields> was created with unknown prop '${key}'`);
    	});

    	function input_binding($$value, each_value, field_index) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			each_value[field_index].elem = $$value;
    			fields.set($fields);
    		});
    	}

    	function input_input_handler(each_value, field_index) {
    		each_value[field_index].val = this.value;
    		fields.set($fields);
    	}

    	$$self.$capture_state = () => ({ onMount, genAC, fields, kd, $fields });
    	return [$fields, kd, input_binding, input_input_handler];
    }

    class Fields extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Fields",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    /* src\Player.svelte generated by Svelte v3.46.4 */
    const file$3 = "src\\Player.svelte";

    function create_fragment$3(ctx) {
    	let div7;
    	let div1;
    	let div0;
    	let div0_class_value;
    	let t0;
    	let div2;
    	let t1;
    	let div3;
    	let t2;
    	let div4;
    	let t3;
    	let div5;
    	let t4;
    	let div6;
    	let div7_resize_listener;
    	let t5;
    	let button;
    	let button_disabled_value;
    	let t6;
    	let iframe;
    	let iframe_src_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div7 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			t0 = space();
    			div2 = element("div");
    			t1 = space();
    			div3 = element("div");
    			t2 = space();
    			div4 = element("div");
    			t3 = space();
    			div5 = element("div");
    			t4 = space();
    			div6 = element("div");
    			t5 = space();
    			button = element("button");
    			t6 = space();
    			iframe = element("iframe");
    			set_style(div0, "width", /*$cPos*/ ctx[4] / /*$maxPos*/ ctx[3] * 100 + "%");
    			set_style(div0, "background-size", /*barWidth*/ ctx[0] + "px 100%");

    			attr_dev(div0, "class", div0_class_value = "h-full border-r box-content border-skipped-900 " + (/*$playing*/ ctx[2]
    			? ' bg-gradient-to-r from-correct-500 via-incorrect-500 to-incorrect-500'
    			: 'bg-gradient-to-r from-correct-500/50 via-incorrect-500/50 to-incorrect-500/50'));

    			add_location(div0, file$3, 41, 8, 1248);
    			attr_dev(div1, "class", "h-full absolute bg-white/30 overflow-hidden");
    			set_style(div1, "width", /*$maxPos*/ ctx[3] / (16 * 1000) * 100 + "%");
    			add_location(div1, file$3, 37, 4, 1110);
    			attr_dev(div2, "class", "w-px h-full absolute bg-white left-1/16");
    			add_location(div2, file$3, 49, 4, 1660);
    			attr_dev(div3, "class", "w-px h-full absolute bg-white left-2/16");
    			add_location(div3, file$3, 50, 4, 1721);
    			attr_dev(div4, "class", "w-px h-full absolute bg-white left-4/16");
    			add_location(div4, file$3, 51, 4, 1782);
    			attr_dev(div5, "class", "w-px h-full absolute bg-white left-7/16");
    			add_location(div5, file$3, 52, 4, 1843);
    			attr_dev(div6, "class", "w-px h-full absolute bg-white left-11/16");
    			add_location(div6, file$3, 53, 4, 1904);
    			attr_dev(div7, "class", "border border-2 mt-3 h-5 relative overflow-hidden");
    			add_render_callback(() => /*div7_elementresize_handler*/ ctx[10].call(div7));
    			add_location(div7, file$3, 36, 0, 1013);
    			attr_dev(button, "class", "animation m-4 svelte-1lkbc99");
    			button.disabled = button_disabled_value = !/*ready*/ ctx[1];
    			toggle_class(button, "playing", /*$playing*/ ctx[2]);
    			add_location(button, file$3, 56, 0, 1972);
    			attr_dev(iframe, "id", "soundcloud");
    			attr_dev(iframe, "allow", "autoplay");
    			if (!src_url_equal(iframe.src, iframe_src_value = "https://w.soundcloud.com/player/?url=" + SOTD.url)) attr_dev(iframe, "src", iframe_src_value);
    			set_style(iframe, "display", "none");
    			add_location(iframe, file$3, 63, 0, 2088);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div7, anchor);
    			append_dev(div7, div1);
    			append_dev(div1, div0);
    			append_dev(div7, t0);
    			append_dev(div7, div2);
    			append_dev(div7, t1);
    			append_dev(div7, div3);
    			append_dev(div7, t2);
    			append_dev(div7, div4);
    			append_dev(div7, t3);
    			append_dev(div7, div5);
    			append_dev(div7, t4);
    			append_dev(div7, div6);
    			div7_resize_listener = add_resize_listener(div7, /*div7_elementresize_handler*/ ctx[10].bind(div7));
    			insert_dev(target, t5, anchor);
    			insert_dev(target, button, anchor);
    			insert_dev(target, t6, anchor);
    			insert_dev(target, iframe, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*play*/ ctx[9], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*$cPos, $maxPos*/ 24) {
    				set_style(div0, "width", /*$cPos*/ ctx[4] / /*$maxPos*/ ctx[3] * 100 + "%");
    			}

    			if (dirty & /*barWidth*/ 1) {
    				set_style(div0, "background-size", /*barWidth*/ ctx[0] + "px 100%");
    			}

    			if (dirty & /*$playing*/ 4 && div0_class_value !== (div0_class_value = "h-full border-r box-content border-skipped-900 " + (/*$playing*/ ctx[2]
    			? ' bg-gradient-to-r from-correct-500 via-incorrect-500 to-incorrect-500'
    			: 'bg-gradient-to-r from-correct-500/50 via-incorrect-500/50 to-incorrect-500/50'))) {
    				attr_dev(div0, "class", div0_class_value);
    			}

    			if (dirty & /*$maxPos*/ 8) {
    				set_style(div1, "width", /*$maxPos*/ ctx[3] / (16 * 1000) * 100 + "%");
    			}

    			if (dirty & /*ready*/ 2 && button_disabled_value !== (button_disabled_value = !/*ready*/ ctx[1])) {
    				prop_dev(button, "disabled", button_disabled_value);
    			}

    			if (dirty & /*$playing*/ 4) {
    				toggle_class(button, "playing", /*$playing*/ ctx[2]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div7);
    			div7_resize_listener();
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(button);
    			if (detaching) detach_dev(t6);
    			if (detaching) detach_dev(iframe);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let $resetOnPlay;
    	let $playing;
    	let $maxPos;
    	let $cPos;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Player', slots, []);
    	let barWidth;
    	let ready = false;
    	const { cPos, playing, maxPos, resetOnPlay } = info;
    	validate_store(cPos, 'cPos');
    	component_subscribe($$self, cPos, value => $$invalidate(4, $cPos = value));
    	validate_store(playing, 'playing');
    	component_subscribe($$self, playing, value => $$invalidate(2, $playing = value));
    	validate_store(maxPos, 'maxPos');
    	component_subscribe($$self, maxPos, value => $$invalidate(3, $maxPos = value));
    	validate_store(resetOnPlay, 'resetOnPlay');
    	component_subscribe($$self, resetOnPlay, value => $$invalidate(12, $resetOnPlay = value));

    	tick().then(() => {
    		info.wid = SC.Widget("soundcloud");

    		info.wid.bind(SC.Widget.Events.PLAY_PROGRESS, e => {
    			if (e.currentPosition >= $maxPos) {
    				info.wid.pause();
    				playing.set(false);
    				resetOnPlay.set(true);
    			} else {
    				cPos.set(e.currentPosition);
    			}
    		});

    		info.wid.bind(SC.Widget.Events.READY, () => $$invalidate(1, ready = true));
    	});

    	function play() {
    		playing.set(!$playing);

    		if ($playing) {
    			if ($resetOnPlay) {
    				info.wid.seekTo(0);
    				cPos.set(0);
    			}

    			info.wid.play();
    		} else {
    			info.wid.pause();
    		}

    		resetOnPlay.set(true);
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Player> was created with unknown prop '${key}'`);
    	});

    	function div7_elementresize_handler() {
    		barWidth = this.clientWidth;
    		$$invalidate(0, barWidth);
    	}

    	$$self.$capture_state = () => ({
    		SOTD,
    		info,
    		tick,
    		barWidth,
    		ready,
    		cPos,
    		playing,
    		maxPos,
    		resetOnPlay,
    		play,
    		$resetOnPlay,
    		$playing,
    		$maxPos,
    		$cPos
    	});

    	$$self.$inject_state = $$props => {
    		if ('barWidth' in $$props) $$invalidate(0, barWidth = $$props.barWidth);
    		if ('ready' in $$props) $$invalidate(1, ready = $$props.ready);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		barWidth,
    		ready,
    		$playing,
    		$maxPos,
    		$cPos,
    		cPos,
    		playing,
    		maxPos,
    		resetOnPlay,
    		play,
    		div7_elementresize_handler
    	];
    }

    class Player extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Player",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* src\Buttons.svelte generated by Svelte v3.46.4 */
    const file$2 = "src\\Buttons.svelte";

    // (9:0) {#if $fields.current}
    function create_if_block(ctx) {
    	let div;
    	let button0;
    	let t0;
    	let t1_value = (/*moreSecs*/ ctx[0] ? ` (+${/*moreSecs*/ ctx[0]}s)` : "") + "";
    	let t1;
    	let t2;
    	let button1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			button0 = element("button");
    			t0 = text("Skip");
    			t1 = text(t1_value);
    			t2 = space();
    			button1 = element("button");
    			button1.textContent = "Submit";
    			attr_dev(button0, "class", "mr-2 w-full h-full text-xl p-5 bg-neutral-500/50 touch:active:bg-neutral-500/70 mouse:hover:bg-neutral-500/70");
    			add_location(button0, file$2, 10, 8, 268);
    			attr_dev(button1, "class", "ml-2 w-full h-full text-xl p-5 bg-submit-700/50 touch:active:bg-submit-700/70 mouse:hover:bg-submit-700/70");
    			add_location(button1, file$2, 20, 8, 568);
    			attr_dev(div, "class", "flex my-4");
    			add_location(div, file$2, 9, 4, 235);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, button0);
    			append_dev(button0, t0);
    			append_dev(button0, t1);
    			append_dev(div, t2);
    			append_dev(div, button1);

    			if (!mounted) {
    				dispose = [
    					listen_dev(
    						button0,
    						"click",
    						function () {
    							if (is_function(/*$fields*/ ctx[1].skip)) /*$fields*/ ctx[1].skip.apply(this, arguments);
    						},
    						false,
    						false,
    						false
    					),
    					listen_dev(
    						button1,
    						"click",
    						function () {
    							if (is_function(/*$fields*/ ctx[1].submit)) /*$fields*/ ctx[1].submit.apply(this, arguments);
    						},
    						false,
    						false,
    						false
    					)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*moreSecs*/ 1 && t1_value !== (t1_value = (/*moreSecs*/ ctx[0] ? ` (+${/*moreSecs*/ ctx[0]}s)` : "") + "")) set_data_dev(t1, t1_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(9:0) {#if $fields.current}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let if_block_anchor;
    	let if_block = /*$fields*/ ctx[1].current && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*$fields*/ ctx[1].current) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let $maxPos;
    	let $fields;
    	validate_store(fields, 'fields');
    	component_subscribe($$self, fields, $$value => $$invalidate(1, $fields = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Buttons', slots, []);
    	let moreSecs = 1;
    	let { maxPos } = info;
    	validate_store(maxPos, 'maxPos');
    	component_subscribe($$self, maxPos, value => $$invalidate(3, $maxPos = value));
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Buttons> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		fields,
    		info,
    		moreSecs,
    		maxPos,
    		$maxPos,
    		$fields
    	});

    	$$self.$inject_state = $$props => {
    		if ('moreSecs' in $$props) $$invalidate(0, moreSecs = $$props.moreSecs);
    		if ('maxPos' in $$props) $$invalidate(2, maxPos = $$props.maxPos);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$maxPos*/ 8) {
    			$$invalidate(0, moreSecs = (info.nextMax() - $maxPos) / 1000);
    		}
    	};

    	return [moreSecs, $fields, maxPos, $maxPos];
    }

    class Buttons extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Buttons",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* src\View.svelte generated by Svelte v3.46.4 */
    const file$1 = "src\\View.svelte";

    function create_fragment$1(ctx) {
    	let div;
    	let h1;
    	let t1;
    	let fields;
    	let t2;
    	let player;
    	let t3;
    	let buttons;
    	let current;
    	fields = new Fields({ $$inline: true });
    	player = new Player({ $$inline: true });
    	buttons = new Buttons({ $$inline: true });

    	const block = {
    		c: function create() {
    			div = element("div");
    			h1 = element("h1");
    			h1.textContent = "Hello hearld";
    			t1 = space();
    			create_component(fields.$$.fragment);
    			t2 = space();
    			create_component(player.$$.fragment);
    			t3 = space();
    			create_component(buttons.$$.fragment);
    			attr_dev(h1, "class", "text-5xl font-bold m-4");
    			add_location(h1, file$1, 7, 4, 209);
    			attr_dev(div, "class", "w-full max-w-xl scale-90 my-[-10vh]");
    			add_location(div, file$1, 6, 0, 154);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h1);
    			append_dev(div, t1);
    			mount_component(fields, div, null);
    			append_dev(div, t2);
    			mount_component(player, div, null);
    			append_dev(div, t3);
    			mount_component(buttons, div, null);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(fields.$$.fragment, local);
    			transition_in(player.$$.fragment, local);
    			transition_in(buttons.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(fields.$$.fragment, local);
    			transition_out(player.$$.fragment, local);
    			transition_out(buttons.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(fields);
    			destroy_component(player);
    			destroy_component(buttons);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('View', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<View> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ Fields, Player, Buttons });
    	return [];
    }

    class View extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "View",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src\App.svelte generated by Svelte v3.46.4 */
    const file = "src\\App.svelte";

    function create_fragment(ctx) {
    	let div;
    	let view;
    	let current;
    	view = new View({ $$inline: true });

    	const block = {
    		c: function create() {
    			div = element("div");
    			create_component(view.$$.fragment);
    			attr_dev(div, "class", "bg-gradient-to-r from-primary-500 to-secondary-500 flex justify-center items-center h-screen rounded-none overflow-auto");
    			add_location(div, file, 4, 0, 59);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(view, div, null);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(view.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(view.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(view);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ View });
    	return [];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    var app = new App({
    	target: document.body
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
