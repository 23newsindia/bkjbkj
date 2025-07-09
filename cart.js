document.addEventListener('DOMContentLoaded', function() {
    "use strict";

    // First check if wc_cart_params exists
    if (typeof wc_cart_params === 'undefined') {
        console.warn('wc_cart_params is not defined');
        return;
    }

    // Utility functions
    const utils = {
        getUrl: (endpoint) => {
            return wc_cart_params.wc_ajax_url.toString().replace('%%endpoint%%', endpoint);
        },

        isBlocked: (element) => {
            return element.classList.contains('processing') || 
                   element.closest('.processing') !== null;
        },

        block: (element) => {
            if (!utils.isBlocked(element)) {
                element.classList.add('processing');
                
                const overlay = document.createElement('div');
                overlay.className = 'blockUI blockOverlay';
                overlay.style.cssText = `
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: #fff;
                    opacity: 0.6;
                    z-index: 1000;
                    cursor: wait;
                `;
                
                element.appendChild(overlay);
            }
        },

        unblock: (element) => {
            element.classList.remove('processing');
            const overlay = element.querySelector('.blockUI.blockOverlay');
            if (overlay) {
                overlay.remove();
            }
        },

        removeDuplicateNotices: () => {
            const notices = document.querySelectorAll('.woocommerce-error, .woocommerce-message, .woocommerce-info, .is-error, .is-info, .is-success');
            const seen = new Set();
            return Array.from(notices).filter(notice => {
                const text = notice.textContent;
                if (!seen.has(text)) {
                    seen.add(text);
                    return true;
                }
                return false;
            });
        },

        showNotice: (html, target) => {
            if (!target) {
                target = document.querySelector('.woocommerce-notices-wrapper') || 
                        document.querySelector('.wc-empty-cart-message')?.closest('.woocommerce') ||
                        document.querySelector('.woocommerce-cart-form');
            }
            
            if (target) {
                if (typeof html === 'string') {
                    target.insertAdjacentHTML('afterbegin', html);
                } else {
                    target.prepend(html);
                }
            }
        },

        showCouponError: (html, target, isLiveRegion = false) => {
            if (!target) return;

            const couponInput = target.querySelector('#coupon_code');
            let errorElement;

            if (typeof html === 'string') {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = html;
                const msg = tempDiv.textContent.trim();
                
                if (!msg) return;
                
                errorElement = document.createElement('p');
                errorElement.className = 'coupon-error-notice';
                errorElement.id = 'coupon-error-notice';
                errorElement.textContent = msg;
            } else {
                errorElement = html;
            }

            if (isLiveRegion) {
                errorElement.setAttribute('role', 'alert');
            }

            if (couponInput) {
                couponInput.classList.add('has-error');
                couponInput.setAttribute('aria-invalid', 'true');
                couponInput.setAttribute('aria-describedby', 'coupon-error-notice');
            }

            target.appendChild(errorElement);
        },

        updateCartTotals: async function() {
            try {
                const response = await fetch(utils.getUrl('get_cart_totals'), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                });

                const html = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const newTotals = doc.querySelector('.cart_totals');

                if (newTotals) {
                    const currentTotals = document.querySelector('.cart_totals');
                    if (currentTotals) {
                        currentTotals.replaceWith(newTotals);
                        const event = new CustomEvent('updated_cart_totals');
                        document.body.dispatchEvent(event);
                    }
                }
            } catch (error) {
                console.error('Error updating cart totals:', error);
            }
        },

        updateWcDiv: async function(htmlStr, preserveNotices = false) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlStr, 'text/html');
            
            const newForm = doc.querySelector('.woocommerce-cart-form');
            const newTotals = doc.querySelector('.cart_totals');
            const notices = utils.removeDuplicateNotices();

            const currentForm = document.querySelector('.woocommerce-cart-form');
            
            if (!currentForm) {
                window.location.reload();
                return;
            }

            if (!preserveNotices) {
                document.querySelectorAll('.woocommerce-error, .woocommerce-message, .woocommerce-info, .is-error, .is-info, .is-success, .coupon-error-notice')
                    .forEach(notice => notice.remove());
            }

            if (!newForm) {
                if (document.querySelector('.woocommerce-checkout')) {
                    window.location.reload();
                    return;
                }

                const emptyCart = doc.querySelector('.wc-empty-cart-message')?.closest('.woocommerce');
                if (emptyCart) {
                    currentForm.closest('.woocommerce').replaceWith(emptyCart);
                }

                if (notices.length > 0) {
                    utils.showNotice(notices);
                }

                const event = new CustomEvent('wc_cart_emptied');
                document.body.dispatchEvent(event);
            } else {
                if (document.querySelector('.woocommerce-checkout')) {
                    const event = new CustomEvent('update_checkout');
                    document.body.dispatchEvent(event);
                }

                const oldCouponValue = document.querySelector('#coupon_code')?.value;
                const oldCouponError = document.querySelector('#coupon_code')
                    ?.closest('.coupon')
                    ?.querySelector('.coupon-error-notice');

                currentForm.replaceWith(newForm);
                
                const updateCartBtn = newForm.querySelector('button[name="update_cart"]');
                if (updateCartBtn) {
                    updateCartBtn.disabled = true;
                }

                if (preserveNotices && oldCouponError) {
                    const newCouponField = newForm.querySelector('#coupon_code');
                    const newCouponWrapper = newCouponField?.closest('.coupon');
                    
                    if (newCouponField && newCouponWrapper) {
                        newCouponField.value = oldCouponValue;
                        newCouponField.focus();
                        utils.showCouponError(oldCouponError, newCouponWrapper, true);
                    }
                }

                if (notices.length > 0) {
                    utils.showNotice(notices);
                }

                await utils.updateCartTotals();
            }

            const event = new CustomEvent('updated_wc_div');
            document.body.dispatchEvent(event);
        }
    };

    // Cart functionality
    const cart = {
        init: function() {
            this.setupEventListeners();
            
            // Fix the invalid selector
            const updateCartBtn = document.querySelector('button[name="update_cart"]');
            if (updateCartBtn) {
                updateCartBtn.disabled = true;
            }
        },

        setupEventListeners: function() {
            // Form submission and coupon application
            document.addEventListener('submit', (e) => {
                if (e.target.matches('.woocommerce-cart-form')) {
                    e.preventDefault();
                    const submitButton = document.activeElement;
                    
                    if (submitButton.name === 'update_cart' || submitButton.matches('input.qty')) {
                        this.quantityUpdate(e.target);
                    } else if (submitButton.name === 'apply_coupon' || submitButton.matches('#coupon_code')) {
                        this.applyCoupon(e.target);
                    }
                }
            });

            // Remove coupon
            document.addEventListener('click', (e) => {
                if (e.target.closest('.woocommerce-remove-coupon')) {
                    e.preventDefault();
                    const link = e.target.closest('.woocommerce-remove-coupon');
                    this.removeCoupon(link.dataset.coupon);
                }
            });

            // Quantity changes
            document.addEventListener('change', (e) => {
                // Fix the invalid selector
                if (e.target.matches('.cart_item input')) {
                    const updateCartBtn = document.querySelector('button[name="update_cart"]');
                    if (updateCartBtn) {
                        updateCartBtn.disabled = false;
                    }
                }
            });

            // Remove coupon error on input change
            document.addEventListener('input', (e) => {
                if (e.target.matches('#coupon_code')) {
                    this.removeCouponError(e.target);
                }
            });
        },

        applyCoupon: async function(form) {
            const couponInput = document.querySelector('#coupon_code');
            const couponCode = couponInput?.value?.trim();
            
            if (!couponCode) return;

            utils.block(form);
            const totals = document.querySelector('.cart_totals');
            if (totals) utils.block(totals);

            try {
                const response = await fetch(utils.getUrl('apply_coupon'), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: new URLSearchParams({
                        security: wc_cart_params.apply_coupon_nonce,
                        coupon_code: couponCode
                    })
                });

                const html = await response.text();
                
                document.querySelectorAll('.woocommerce-error, .woocommerce-message, .woocommerce-info, .is-error, .is-info, .is-success, .coupon-error-notice')
                    .forEach(notice => notice.remove());

                if (!html.includes('woocommerce-error') && !html.includes('is-error')) {
                    utils.showNotice(html);
                    await utils.updateCartTotals();
                } else {
                    const couponWrapper = couponInput?.closest('.coupon');
                    if (couponWrapper) {
                        utils.showCouponError(html, couponWrapper, false);
                    }
                }

                const event = new CustomEvent('applied_coupon', { detail: { coupon: couponCode } });
                document.body.dispatchEvent(event);
            } catch (error) {
                console.error('Error applying coupon:', error);
            } finally {
                utils.unblock(form);
                if (totals) utils.unblock(totals);
            }
        },

        removeCoupon: async function(coupon) {
            const wrapper = document.querySelector('.cart_totals');
            if (!wrapper) return;

            utils.block(wrapper);

            try {
                const response = await fetch(utils.getUrl('remove_coupon'), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: new URLSearchParams({
                        security: wc_cart_params.remove_coupon_nonce,
                        coupon: coupon
                    })
                });

                const html = await response.text();
                
                document.querySelectorAll('.woocommerce-error, .woocommerce-message, .woocommerce-info, .is-error, .is-info, .is-success')
                    .forEach(notice => notice.remove());
                
                utils.showNotice(html);

                const event = new CustomEvent('removed_coupon', { detail: { coupon } });
                document.body.dispatchEvent(event);

                await utils.updateCartTotals();
            } catch (error) {
                console.error('Error removing coupon:', error);
            } finally {
                utils.unblock(wrapper);
            }
        },

        removeCouponError: function(input) {
            input.classList.remove('has-error');
            input.removeAttribute('aria-invalid');
            input.removeAttribute('aria-describedby');
            
            const errorNotice = input.closest('.coupon')?.querySelector('.coupon-error-notice');
            if (errorNotice) {
                errorNotice.remove();
            }
        },

        updateCart: async function(preserveNotices = false) {
            const form = document.querySelector('.woocommerce-cart-form');
            const totals = document.querySelector('.cart_totals');
            
            if (!form) return;

            utils.block(form);
            if (totals) utils.block(totals);

            try {
                const response = await fetch(form.action, {
                    method: form.method,
                    body: new URLSearchParams(new FormData(form))
                });

                const html = await response.text();
                await utils.updateWcDiv(html, preserveNotices);
                
                const alertElement = document.querySelector('[role="alert"]');
                if (alertElement) {
                    alertElement.scrollIntoView({ behavior: 'smooth' });
                }
            } catch (error) {
                console.error('Error updating cart:', error);
            } finally {
                utils.unblock(form);
                if (totals) utils.unblock(totals);
            }
        },

        quantityUpdate: async function(form) {
            utils.block(form);
            const totals = document.querySelector('.cart_totals');
            if (totals) utils.block(totals);

            const formData = new FormData(form);
            formData.append('update_cart', 'Update Cart');

            try {
                const response = await fetch(form.action, {
                    method: form.method,
                    body: new URLSearchParams(formData)
                });

                const html = await response.text();
                await utils.updateWcDiv(html);
                
                const alertElement = document.querySelector('[role="alert"]');
                if (alertElement) {
                    alertElement.scrollIntoView({ behavior: 'smooth' });
                }
            } catch (error) {
                console.error('Error updating quantity:', error);
            } finally {
                utils.unblock(form);
                if (totals) utils.unblock(totals);
            }
        }
    };

    // Initialize cart functionality
    cart.init();
});
