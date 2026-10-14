/*
 * Xpektrum Laser – theme behaviour. Vanilla JS, no dependencies.
 * Header state, menus, scroll reveal, workflow carousel, dialogs, migrated-content widgets, quote form.
 * Copied to assets/built/main.js by the build (tools/package.json → build:js).
 */
(function () {
    'use strict';

    var doc = document.documentElement;
    doc.classList.add('js');
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var $ = function (sel, root) { return (root || document).querySelector(sel); };
    var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

    /* ------------------------------------------------------------ header */
    var header = $('.xp-header');
    if (header) {
        var onScroll = function () { header.classList.toggle('is-scrolled', window.scrollY > 20); };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }

    function toggleDisclosure(button, panel, open) {
        var isOpen = typeof open === 'boolean' ? open : button.getAttribute('aria-expanded') !== 'true';
        button.setAttribute('aria-expanded', String(isOpen));
        panel.hidden = !isOpen;
        return isOpen;
    }

    // Services dropdown: click/keyboard toggle, hover on pointer devices, close on outside click and Escape.
    $$('.xp-dropdown').forEach(function (dropdown) {
        var button = $('.xp-dropdown-toggle', dropdown);
        var menu = $('.xp-dropdown-menu', dropdown);
        if (!button || !menu) return;
        button.addEventListener('click', function () { toggleDisclosure(button, menu); });
        if (window.matchMedia('(hover: hover)').matches) {
            var timer;
            dropdown.addEventListener('mouseenter', function () { clearTimeout(timer); toggleDisclosure(button, menu, true); });
            dropdown.addEventListener('mouseleave', function () { timer = setTimeout(function () { toggleDisclosure(button, menu, false); }, 150); });
        }
        document.addEventListener('click', function (e) { if (!dropdown.contains(e.target)) toggleDisclosure(button, menu, false); });
        dropdown.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { toggleDisclosure(button, menu, false); button.focus(); }
        });
    });

    var menuToggle = $('.xp-menu-toggle');
    var mobileMenu = $('#xp-mobile-menu');
    if (menuToggle && mobileMenu) {
        menuToggle.addEventListener('click', function () {
            var open = toggleDisclosure(menuToggle, mobileMenu);
            menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && menuToggle.getAttribute('aria-expanded') === 'true') {
                toggleDisclosure(menuToggle, mobileMenu, false);
                menuToggle.focus();
            }
        });
    }

    /* ------------------------------------------------------------ scroll reveal */
    var revealTargets = $$('.xp-reveal');
    // Migrated content uses data-visible="true|false" toggles (Tailwind data-[visible=true]: variants).
    $$('.xp-legacy [data-visible]').forEach(function (el) {
        if (el.getBoundingClientRect().top > window.innerHeight) el.setAttribute('data-visible', 'false');
        revealTargets.push(el);
    });
    var show = function (el) {
        if (el.hasAttribute('data-visible')) el.setAttribute('data-visible', 'true');
        else el.classList.add('is-visible');
    };
    if (reduceMotion || !('IntersectionObserver' in window)) {
        revealTargets.forEach(show);
    } else {
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) { show(entry.target); io.unobserve(entry.target); }
            });
        }, { threshold: 0.12 });
        revealTargets.forEach(function (el) { io.observe(el); });
    }

    /* ------------------------------------------------------------ workflow carousel */
    $$('.xp-carousel').forEach(function (carousel) {
        var viewport = $('.xp-carousel-viewport', carousel);
        var steps = $$('.xp-step', carousel);
        var controls = $('.xp-carousel-controls', carousel);
        var dotsWrap = $('.xp-carousel-dots', carousel);
        var prev = $('.xp-carousel-prev', carousel);
        var next = $('.xp-carousel-next', carousel);
        if (!viewport || !steps.length) return;
        var active = 0;

        var dots = steps.map(function (step, i) {
            var dot = document.createElement('button');
            dot.type = 'button';
            dot.className = 'xp-dot rounded-none';
            dot.setAttribute('aria-label', 'Go to step ' + (i + 1));
            dot.addEventListener('click', function () { setActive(i, true); });
            dotsWrap.appendChild(dot);
            return dot;
        });

        function setActive(i, scroll) {
            active = Math.max(0, Math.min(steps.length - 1, i));
            steps.forEach(function (s, n) { s.toggleAttribute('data-active', n === active); });
            dots.forEach(function (d, n) { d.setAttribute('aria-current', String(n === active)); });
            prev.disabled = active === 0;
            next.disabled = active === steps.length - 1;
            if (scroll) {
                var target = steps[active];
                var maxScroll = viewport.scrollWidth - viewport.clientWidth;
                var left = Math.min(maxScroll, target.offsetLeft - viewport.offsetLeft);
                viewport.scrollTo({ left: left, behavior: reduceMotion ? 'auto' : 'smooth' });
            }
        }

        prev.addEventListener('click', function () { setActive(active - 1, true); });
        next.addEventListener('click', function () { setActive(active + 1, true); });
        steps.forEach(function (s, i) { s.addEventListener('click', function () { setActive(i, true); }); });

        // When the user swipes, follow the snapped slide (only matters when one or three steps are visible).
        var scrollTimer;
        viewport.addEventListener('scroll', function () {
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(function () {
                if (viewport.scrollWidth <= viewport.clientWidth + 4) return;
                var x = viewport.scrollLeft;
                var nearest = 0;
                steps.forEach(function (s, i) {
                    if (Math.abs(s.offsetLeft - viewport.offsetLeft - x) < Math.abs(steps[nearest].offsetLeft - viewport.offsetLeft - x)) nearest = i;
                });
                if (nearest !== active && x > 0) setActive(nearest, false);
            }, 120);
        }, { passive: true });

        viewport.style.overflowX = 'hidden';
        controls.hidden = false;
        setActive(0, false);
        viewport.style.overflowX = '';
    });

    /* ------------------------------------------------------------ dialogs */
    function openDialog(dialog, opener) {
        if (!dialog || typeof dialog.showModal !== 'function') return false;
        dialog.showModal();
        dialog.addEventListener('close', function onClose() {
            dialog.removeEventListener('close', onClose);
            if (opener) opener.focus();
        });
        return true;
    }
    document.addEventListener('click', function (e) {
        var trigger = e.target.closest('[data-xp-dialog]');
        if (trigger && !(e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1)) {
            if (openDialog(document.getElementById(trigger.getAttribute('data-xp-dialog')), trigger)) e.preventDefault();
            return;
        }
        var close = e.target.closest('.xp-dialog-close');
        if (close) { close.closest('dialog').close(); return; }
        // Click on the backdrop closes the dialog.
        if (e.target.tagName === 'DIALOG' && e.target.open) {
            var r = e.target.getBoundingClientRect();
            if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) e.target.close();
        }
    });
    // Migrated dialogs may contain the builder's own close button.
    $$('.xp-legacy dialog button').forEach(function (b) {
        if (/close/i.test(b.textContent + (b.getAttribute('aria-label') || ''))) b.addEventListener('click', function () { b.closest('dialog').close(); });
    });

    /* ------------------------------------------------------------ migrated widgets: tabs, accordions, carousels */
    $$('.xp-legacy [role="tablist"]').forEach(function (list) {
        var tabs = $$('[role="tab"]', list);
        function select(tab, focus) {
            tabs.forEach(function (t) {
                var selected = t === tab;
                var panel = document.getElementById(t.getAttribute('aria-controls'));
                t.setAttribute('aria-selected', String(selected));
                t.setAttribute('data-state', selected ? 'active' : 'inactive');
                t.tabIndex = selected ? 0 : -1;
                if (panel) { panel.hidden = !selected; panel.setAttribute('data-state', selected ? 'active' : 'inactive'); }
            });
            if (focus) tab.focus();
        }
        tabs.forEach(function (tab, i) {
            tab.addEventListener('click', function () { select(tab); });
            tab.addEventListener('keydown', function (e) {
                var vertical = list.getAttribute('aria-orientation') === 'vertical' || list.getAttribute('data-orientation') === 'vertical';
                var nextKey = vertical ? 'ArrowDown' : 'ArrowRight';
                var prevKey = vertical ? 'ArrowUp' : 'ArrowLeft';
                if (e.key === nextKey) { e.preventDefault(); select(tabs[(i + 1) % tabs.length], true); }
                if (e.key === prevKey) { e.preventDefault(); select(tabs[(i - 1 + tabs.length) % tabs.length], true); }
                if (e.key === 'Home') { e.preventDefault(); select(tabs[0], true); }
                if (e.key === 'End') { e.preventDefault(); select(tabs[tabs.length - 1], true); }
            });
        });
    });

    $$('.xp-legacy [data-slot="accordion-trigger"]').forEach(function (trigger) {
        trigger.addEventListener('click', function () {
            var panel = document.getElementById(trigger.getAttribute('aria-controls'));
            var open = trigger.getAttribute('aria-expanded') !== 'true';
            var state = open ? 'open' : 'closed';
            trigger.setAttribute('aria-expanded', String(open));
            [trigger, trigger.parentElement, trigger.closest('[data-slot="accordion-item"]'), panel].forEach(function (el) {
                if (el) el.setAttribute('data-state', state);
            });
            if (panel) panel.hidden = !open;
        });
    });

    $$('.xp-legacy [data-slot="carousel"]').forEach(function (carousel) {
        var viewport = $('[data-slot="carousel-content"]', carousel);
        if (!viewport) return;
        var step = function (dir) {
            var item = $('[data-slot="carousel-item"]', viewport);
            var amount = item ? item.getBoundingClientRect().width : viewport.clientWidth;
            viewport.scrollBy({ left: dir * amount, behavior: reduceMotion ? 'auto' : 'smooth' });
        };
        var prev = $('[data-slot="carousel-previous"]', carousel);
        var next = $('[data-slot="carousel-next"]', carousel);
        if (prev) { prev.disabled = false; prev.addEventListener('click', function () { step(-1); }); }
        if (next) { next.disabled = false; next.addEventListener('click', function () { step(1); }); }
    });

    /* ------------------------------------------------------------ quote form */
    var quote = $('[data-xp-quote]');
    var form = quote && $('form[data-xp-form="quote"]', quote);
    if (form) {
        var status = form.parentElement.querySelector('.xp-form-status');
        var submit = $('button[type="submit"]', form);
        var endpoint = quote.getAttribute('data-endpoint');
        var email = quote.getAttribute('data-email');
        var success = quote.getAttribute('data-success');
        var submitLabel = submit ? submit.innerHTML : '';

        var setStatus = function (state, text) {
            if (!status) return;
            status.hidden = false;
            status.setAttribute('data-state', state);
            status.textContent = text;
        };

        var mailtoFallback = function (data) {
            var body = ['Name: ' + data.get('name'), 'Email: ' + data.get('email'), 'Phone: ' + data.get('phone'),
                'Service: ' + (data.get('project_type') || '-'), '', data.get('project_details')].join('\n');
            window.location.href = 'mailto:' + email + '?subject=' + encodeURIComponent('Quote request – ' + data.get('name')) + '&body=' + encodeURIComponent(body);
        };

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            if (!form.reportValidity()) return;
            var data = new FormData(form);
            if (data.get('_gotcha')) return; // honeypot
            if (!endpoint) { mailtoFallback(data); return; }

            if (submit) { submit.disabled = true; submit.textContent = 'Processing Data…'; }
            data.append('_subject', 'Quote request – ' + data.get('name'));
            fetch(endpoint, { method: 'POST', body: data, headers: { Accept: 'application/json' } })
                .then(function (res) {
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    form.reset();
                    form.hidden = true;
                    setStatus('success', success);
                    status && status.focus && status.setAttribute('tabindex', '-1');
                    status && status.focus();
                })
                .catch(function () {
                    setStatus('error', 'Transmission failed. Please email ' + email + ' or call us – your details were not lost.');
                })
                .finally(function () {
                    if (submit) { submit.disabled = false; submit.innerHTML = submitLabel; }
                });
        });
    }
})();
