// Main checkout functionality
const CheckoutHandler = {
  init: function() {
    this.setupFormFields();
    this.setupEventListeners();
    this.moveValidateNotices();
    this.updateCheckoutContactInfo();
  },
  
  setupFormFields: function() {
    // Remove form-row class from payment fields
    const paymentFormRows = document.querySelectorAll('#payment .form-row');
    paymentFormRows.forEach(row => {
      row.classList.remove('form-row');
    });
    
    // Process form fields for placeholder and active state
    const formFields = document.querySelectorAll('#main-content .form-row input, #main-content .form-row select, #main-content .form-row textarea');
    formFields.forEach(field => {
      const formRow = field.closest('.form-row');
      
      if (formRow && !formRow.closest('#order_review, #payment')) {
        const isEditAccountForm = field.closest('form.woocommerce-EditAccountForm') !== null;
        const fieldValue = field.value;
        
        // Add * required to placeholder
        if (formRow.classList.contains('validate-required') && formRow.querySelector('label[for]')) {
          const placeholder = field.getAttribute('placeholder');
          
          if (placeholder) {
            const requiredMark = formRow.querySelector('label[for] .required') ? 
                                formRow.querySelector('label[for] .required').textContent : '*';
            field.setAttribute('placeholder', placeholder + ' ' + requiredMark);
          }
        }
        
        // Check if field should be active
        if ((fieldValue !== '' || isEditAccountForm) && formRow.querySelector('label[for]')) {
          const forAttr = formRow.querySelector('label[for]').getAttribute('for');
          const isSpecialField = formRow.querySelector(`input[type="hidden"]#${forAttr}, input[type="radio"]#${forAttr}, input[type="checkbox"]#${forAttr}`);
          
          if (!isSpecialField) {
            if (!formRow.classList.contains('nasa-actived')) {
              formRow.classList.add('nasa-actived');
            }
          } else {
            if (!formRow.classList.contains('nasa-dffr')) {
              formRow.classList.add('nasa-dffr');
            }
          }
        }
      }
    });
  },
  
  setupEventListeners: function() {
    // Input field focus/blur events
    document.addEventListener('keyup', (e) => {
      if (e.target.matches('#main-content .form-row input, #main-content .form-row textarea')) {
        this.handleInputChange(e.target);
      }
    });
    
    // Select field change events
    document.addEventListener('change', (e) => {
      if (e.target.matches('#main-content .form-row select')) {
        this.handleSelectChange(e.target);
      }
      
      // Shipping method changes
      if (e.target.matches('select.shipping_method, input[name^="shipping_method"], #ship-to-different-address input, .update_totals_on_change select, .update_totals_on_change input[type="radio"], .update_totals_on_change input[type="checkbox"]')) {
        const checkoutReviewOrder = document.querySelector('.woocommerce-checkout-review-order');
        if (checkoutReviewOrder && !checkoutReviewOrder.classList.contains('processing')) {
          checkoutReviewOrder.classList.add('processing');
        }
      }

      // Clear payment errors when method selected
      if (e.target.matches('#payment input[name="payment_method"]')) {
        const error = document.querySelector('#payment .nasa-error');
        if (error) error.remove();
      }
    });
    
    // Billing step navigation
    document.addEventListener('click', (e) => {
      if (e.target.matches('.nasa-billing-step')) {
        this.handleBillingStep(e.target);
      } else if (e.target.matches('.nasa-shipping-step')) {
        this.handleShippingStep(e.target);
      } else if (e.target.matches('.nasa-payment-step')) {
        this.handlePaymentStep(e.target);
      } else if (e.target.matches('.showcoupon')) {
        const woocommerceError = document.querySelector('.woocommerce-error');
        if (woocommerceError) {
          woocommerceError.style.display = 'none';
        }
      } else if (e.target.matches('.form-row .add-field')) {
        this.handleAddField(e.target);
      } else if (e.target.matches('input[name="ns-billing-select"]')) {
        this.handleBillingSelect(e.target);
      }
    });
    
    // Email field interaction
    document.addEventListener('click', (e) => {
      if (e.target.matches('#ns-email-add')) {
        this.handleEmailFieldClick(e.target);
      }
    });
    
    // Form submission handler
    let submitLock = false;
    document.addEventListener('submit', (e) => {
      if (e.target.matches('form.checkout')) {
        if (submitLock) {
          e.preventDefault();
          return;
        }
        
        if (!this.validateFormCheckout()) {
          e.preventDefault();
          e.stopImmediatePropagation();
          this.scrollToFirstError();
          return;
        }
        
        submitLock = true;
        setTimeout(() => submitLock = false, 3000);
      }
    });
    
    // Custom events
    document.body.addEventListener('nasa_update_custommer_info', () => {
      this.updateCustomerInfo();
    });
    
    document.body.addEventListener('updated_checkout', () => {
      this.handleUpdatedCheckout();
    });
  },
  
  handleEmailFieldClick: function(emailField) {
    if (emailField.disabled) {
      const wrapper = emailField.closest('.woocommerce-input-wrapper');
      if (wrapper) {
        const billingEmail = document.createElement('input');
        billingEmail.type = 'email';
        billingEmail.className = 'input-text';
        billingEmail.name = 'billing_email';
        billingEmail.id = 'billing_email';
        billingEmail.placeholder = 'Email *';
        billingEmail.setAttribute('aria-required', 'true');
        billingEmail.setAttribute('autocomplete', 'email');
        billingEmail.required = true;
        billingEmail.value = emailField.value || '';
        
        wrapper.replaceChild(billingEmail, emailField);
        billingEmail.focus();
        
        const formRow = wrapper.closest('.form-row');
        if (formRow) {
          formRow.classList.add('nasa-actived');
          formRow.id = 'billing_email_field'; 
        }
      }
    }
  },
  
  handleInputChange: function(input) {
    const formRow = input.closest('.form-row');
    
    if (formRow && !formRow.classList.contains('nasa-dffr') && formRow.querySelector('label[for]')) {
      if (input.value !== '') {
        if (!formRow.classList.contains('nasa-actived')) {
          formRow.classList.add('nasa-actived');
        }
        
        const errorElement = formRow.querySelector('.nasa-error');
        if (errorElement) {
          errorElement.remove();
        }
      } else {
        const isEditAccountForm = input.closest('form.woocommerce-EditAccountForm') !== null;
        if (!isEditAccountForm) {
          formRow.classList.remove('nasa-actived');
        }
      }
    }
    
    // Remove all error messages
    document.querySelectorAll('.nasa-error').forEach(error => error.remove());
    
    // Reset validation state
    const checkoutForm = document.querySelector('form.checkout');
    if (checkoutForm) {
      checkoutForm.classList.remove('ns-validated-first');
    }
  },
  
  handleSelectChange: function(select) {
    const formRow = select.closest('.form-row');
    
    if (formRow && !formRow.classList.contains('nasa-dffr') && formRow.querySelector('label[for]')) {
      if (select.value !== '') {
        if (!formRow.classList.contains('nasa-actived')) {
          formRow.classList.add('nasa-actived');
        }
        
        const errorElement = formRow.querySelector('.nasa-error');
        if (errorElement) {
          errorElement.remove();
        }
      } else {
        const isEditAccountForm = select.closest('form.woocommerce-EditAccountForm') !== null;
        if (!isEditAccountForm) {
          formRow.classList.remove('nasa-actived');
        }
      }
    }
    
    // Remove all error messages
    document.querySelectorAll('.nasa-error').forEach(error => error.remove());
    
    // Reset validation state
    const checkoutForm = document.querySelector('form.checkout');
    if (checkoutForm) {
      checkoutForm.classList.remove('ns-validated-first');
    }
  },
  
  handleBillingStep: function() {
    const checkoutForm = document.querySelector('form.checkout');
    if (!checkoutForm) return false;
    
    if (!checkoutForm.classList.contains('ns-validating') && 
        !document.querySelector('.nasa-bc-modern .nasa-billing-step').classList.contains('active')) {
      
      const updateEvent = new CustomEvent('nasa_update_custommer_info');
      document.body.dispatchEvent(updateEvent);
      
      const contactSection = document.getElementById('ns-checkout-contact');
      const billingSection = document.querySelector('.woo-billing');
      const billingStepSection = document.getElementById('nasa-step_billing');
      
      if (contactSection) contactSection.style.display = 'block';
      if (billingSection) billingSection.style.display = 'block';
      if (billingStepSection) billingStepSection.style.display = 'block';
      
      const loginToggle = document.querySelector('.woocommerce-form-login-toggle');
      if (loginToggle) loginToggle.style.display = 'block';
      
      const additionalFields = document.querySelector('.woocommerce-additional-fields');
      const billingInfo = document.getElementById('nasa-billing-info');
      const shippingMethods = document.getElementById('nasa-shipping-methods');
      const stepPayment = document.getElementById('nasa-step_payment');
      const paymentWrap = document.getElementById('nasa-payment-wrap');
      const billingDetailWrap = document.getElementById('nasa-billing-detail-wrap');
      
      if (additionalFields) additionalFields.style.display = 'none';
      if (billingInfo) billingInfo.style.display = 'none';
      if (shippingMethods) shippingMethods.style.display = 'none';
      if (stepPayment) stepPayment.style.display = 'none';
      if (paymentWrap) paymentWrap.style.display = 'none';
      if (billingDetailWrap) billingDetailWrap.style.display = 'none';
      
      const billingStep = document.querySelector('.nasa-bc-modern .nasa-billing-step');
      const shippingStep = document.querySelector('.nasa-bc-modern .nasa-shipping-step');
      const paymentStep = document.querySelector('.nasa-bc-modern .nasa-payment-step');
      
      if (billingStep) billingStep.classList.add('active');
      if (shippingStep) shippingStep.classList.remove('active');
      if (paymentStep) paymentStep.classList.remove('active');
    }
  },
  
  handleShippingStep: function(element) {
    if (element && element.preventDefault) {
        element.preventDefault();
    }

    const checkoutForm = document.querySelector('form.checkout');
    if (!checkoutForm) return false;
    
    if (checkoutForm.classList.contains('ns-validating') || 
        document.querySelector('.nasa-bc-modern .nasa-shipping-step').classList.contains('active')) {
        return false;
    }
    
    const isValid = this.validateFormCheckout();
    
    if (!isValid) {
        this.scrollToFirstError();
        document.querySelector('.nasa-billing-step')?.click();
        return false;
    }
    
    try {
        const updateEvent = new CustomEvent('nasa_update_custommer_info');
        document.body.dispatchEvent(updateEvent);
        
        const sectionsToShow = [
            '.woocommerce-additional-fields',
            '#nasa-billing-info',
            '#nasa-shipping-methods',
            '#nasa-step_payment'
        ];
        
        sectionsToShow.forEach(selector => {
            const el = document.querySelector(selector);
            if (el) el.style.display = 'block';
        });
        
        const sectionsToHide = [
            '#ns-checkout-contact',
            '.woo-billing',
            '#nasa-step_billing',
            '#nasa-payment-wrap',
            '#nasa-billing-detail-wrap',
            '.woocommerce-form-login-toggle',
            '.woocommerce-form-login'
        ];
        
        sectionsToHide.forEach(selector => {
            const el = document.querySelector(selector);
            if (el) el.style.display = 'none';
        });
        
        const billingStep = document.querySelector('.nasa-bc-modern .nasa-billing-step');
        const shippingStep = document.querySelector('.nasa-bc-modern .nasa-shipping-step');
        const paymentStep = document.querySelector('.nasa-bc-modern .nasa-payment-step');
        
        if (billingStep) billingStep.classList.remove('active');
        if (shippingStep) shippingStep.classList.add('active');
        if (paymentStep) paymentStep.classList.remove('active');
        
    } catch (error) {
        console.error('Error in shipping step handler:', error);
        return false;
    }
    
    return false;
  },
  
  handlePaymentStep: function(element) {
    const checkoutForm = document.querySelector('form.checkout');
    if (!checkoutForm) return false;
    
    if (!checkoutForm.classList.contains('ns-validating') && 
        !document.querySelector('.nasa-bc-modern .nasa-payment-step').classList.contains('active')) {
      
      const isValid = this.validateFormCheckout();
      
      if (isValid) {
        const updateEvent = new CustomEvent('nasa_update_custommer_info');
        document.body.dispatchEvent(updateEvent);
        
        const paymentWrap = document.getElementById('nasa-payment-wrap');
        const billingInfo = document.getElementById('nasa-billing-info');
        const billingDetailWrap = document.getElementById('nasa-billing-detail-wrap');
        
        if (paymentWrap) paymentWrap.style.display = 'block';
        if (billingInfo) billingInfo.style.display = 'block';
        if (billingDetailWrap) billingDetailWrap.style.display = 'block';
        
        const contactSection = document.getElementById('ns-checkout-contact');
        const additionalFields = document.querySelector('.woocommerce-additional-fields');
        const billingSection = document.querySelector('.woo-billing');
        const shippingMethods = document.getElementById('nasa-shipping-methods');
        const stepPayment = document.getElementById('nasa-step_payment');
        const billingStepSection = document.getElementById('nasa-step_billing');
        
        if (contactSection) contactSection.style.display = 'none';
        if (additionalFields) additionalFields.style.display = 'none';
        if (billingSection) billingSection.style.display = 'none';
        if (shippingMethods) shippingMethods.style.display = 'none';
        if (stepPayment) stepPayment.style.display = 'none';
        if (billingStepSection) billingStepSection.style.display = 'none';
        
        const loginToggle = document.querySelector('.woocommerce-form-login-toggle');
        const loginForm = document.querySelector('.woocommerce-form-login');
        if (loginToggle) loginToggle.style.display = 'none';
        if (loginForm) loginForm.style.display = 'none';
        
        const customerInfo = document.querySelector('#nasa-billing-info .customer-info');
        if (customerInfo) {
          customerInfo.classList.remove('hidden-tag');
        }
        
        const billingStep = document.querySelector('.nasa-bc-modern .nasa-billing-step');
        const shippingStep = document.querySelector('.nasa-bc-modern .nasa-shipping-step');
        const paymentStep = document.querySelector('.nasa-bc-modern .nasa-payment-step');
        
        if (billingStep) billingStep.classList.remove('active');
        if (shippingStep) shippingStep.classList.remove('active');
        if (paymentStep) paymentStep.classList.add('active');
        
        if (paymentWrap && !document.querySelector('#nasa-payment-wrap .ns-bottom_place_order')) {
          const placeOrder = document.querySelector('#nasa-payment-wrap .place-order');
          const placeOrderBtn = placeOrder ? placeOrder.querySelector('#place_order') : null;
          
          if (placeOrder && placeOrderBtn) {
            const bottomPlaceOrder = document.createElement('div');
            bottomPlaceOrder.className = 'ns-bottom_place_order';
            placeOrder.appendChild(bottomPlaceOrder);
            bottomPlaceOrder.appendChild(placeOrderBtn);
          }
        }
      } else {
        this.scrollToFirstError();
        document.querySelector('.nasa-shipping-step')?.click();
      }
    }
  },
  
  handleAddField: function(element) {
    const target = element.getAttribute('data-target');
    const formRow = element.closest('.form-row');
    
    if (document.getElementById(target)) {
      DOMHelper.slideDown(document.getElementById(target));
    }
    
    DOMHelper.slideUp(formRow);
  },
  
  handleBillingSelect: function(element) {
    const differentShipping = document.querySelector('.ns-different-shipping .woocommerce-billing-fields');
    
    if (element.value === 'different') {
      if (differentShipping) {
        DOMHelper.slideDown(differentShipping);
      }
    } else {
      if (differentShipping) {
        DOMHelper.slideUp(differentShipping);
      }
    }
    
    const event = new CustomEvent('country_to_state_changed');
    document.body.dispatchEvent(event);
  },
  
  updateCustomerInfo: function() {
    const paymentFormRows = document.querySelectorAll('#payment .form-row');
    paymentFormRows.forEach(row => {
      row.classList.remove('form-row');
    });
    
    const noticeGroups = document.querySelectorAll('.woocommerce-NoticeGroup-checkout, .woocommerce-error, .woocommerce-message');
    noticeGroups.forEach(notice => notice.remove());
    
    this.validateFormCheckoutPost();
    
    const updateEvent = new CustomEvent('update_checkout');
    document.body.dispatchEvent(updateEvent);
    
    const billingEmail = document.querySelector('input[name="billing_email"]');
    const customerInfoEmail = document.querySelector('#nasa-billing-info .customer-info-email .customer-info-right');
    
    if (billingEmail && customerInfoEmail) {
      customerInfoEmail.innerHTML = billingEmail.value;
    }
  },
  
  handleUpdatedCheckout: function() {
    const checkoutModernWrap = document.querySelector('.checkout-modern-wrap');
    if (!checkoutModernWrap) return;
    
    document.querySelectorAll('.processing').forEach(element => {
      element.classList.remove('processing');
    });
    
    this.updateShippingMethods();
    
    const additionalFields = document.querySelector('.checkout-modern-wrap .woocommerce-additional-fields');
    const shippingMethods = document.getElementById('nasa-shipping-methods');
    
    if (additionalFields && shippingMethods) {
      shippingMethods.after(additionalFields);
    }
    
    const reviewOrderTable = document.querySelector('.woocommerce-checkout-review-order-table');
    if (reviewOrderTable) {
      reviewOrderTable.classList.add('nasa-loaded');
    }
  },
  
  updateShippingMethods: function() {
    const shippingWrapModern = document.querySelector('.shipping-wrap-modern');
    const orderShippingModern = document.querySelector('.order-shipping-modern');
    
    if (!shippingWrapModern || !orderShippingModern) return;
    
    let shippingHtml = '';
    let available = false;
    let availableHtml = '';
    
    const shippingPackages = document.querySelectorAll('.shipping-wrap-modern');
    shippingPackages.forEach(pkg => {
      const shippingMethod = pkg.querySelector('#shipping_method');
      
      if (shippingMethod) {
        const packageName = pkg.querySelector('.shipping-package-name').innerHTML;
        
        shippingHtml += '<tr class="order-shipping-modern woocommerce-shipping-totals shipping">';
        shippingHtml += '<th>' + packageName + '</th>';
        shippingHtml += '<td>';
        shippingHtml += '<ul id="shipping_method_clone" class="woocommerce-shipping-methods-clone">';
        
        const methods = shippingMethod.querySelectorAll('li');
        methods.forEach(method => {
          if (method.querySelector('select.shipping_method, input[name^="shipping_method"][type="radio"]:checked, input[name^="shipping_method"][type="hidden"]')) {
            const methodClone = method.cloneNode(true);
            
            const elementsToRemove = methodClone.querySelectorAll('select.shipping_method, input[name^="shipping_method"][type="radio"]:checked, input[name^="shipping_method"][type="hidden"], button, .button, script, #lpc_layer_error_message');
            elementsToRemove.forEach(el => el.remove());
            
            availableHtml = methodClone.innerHTML;
            shippingHtml += '<li>' + availableHtml + '</li>';
            
            available = true;
          }
        });
        
        shippingHtml += '</ul>';
        shippingHtml += '</td></tr>';
      } else {
        const customerInfoMethod = document.querySelector('#nasa-billing-info .customer-info-method');
        if (customerInfoMethod) {
          customerInfoMethod.remove();
        }
      }
    });
    
    if (available) {
      orderShippingModern.outerHTML = shippingHtml;
      
      const customerInfoMethodRight = document.querySelector('#nasa-billing-info .customer-info-method .customer-info-right');
      if (customerInfoMethodRight) {
        customerInfoMethodRight.innerHTML = availableHtml;
      }
    }
  },
  
  moveValidateNotices: function() {
    const errorContainers = document.querySelectorAll('.woocommerce-error');
    if (!errorContainers.length) return;

    errorContainers.forEach(errorContainer => {
        const errorItems = errorContainer.querySelectorAll('li');
        if (!errorItems.length) return;

        errorItems.forEach(item => {
            const dataId = item.getAttribute('data-id');
            
            if (dataId) {
                const field = document.getElementById(dataId);
                let formRow = null;
                if (field) {
                    formRow = field.closest('.form-row:not([style*="display: none"])');
                }

                if (formRow) {
                    const errorContent = item.textContent.trim();
                    let errorElement = formRow.querySelector('.nasa-error');
                    
                    if (!errorElement) {
                        errorElement = document.createElement('span');
                        errorElement.className = 'nasa-error';
                        
                        const inputWrapper = field.closest('.woocommerce-input-wrapper');
                        if (inputWrapper) {
                            inputWrapper.appendChild(errorElement);
                        } else if (field) {
                            field.parentNode.insertBefore(errorElement, field.nextSibling);
                        } else {
                            formRow.appendChild(errorElement);
                        }
                    }
                    
                    errorElement.textContent = errorContent;
                    formRow.classList.remove('woocommerce-validated');
                    formRow.classList.add('woocommerce-invalid', 'nasa-highlight-error');
                    item.remove();
                    
                    setTimeout(() => {
                        formRow.classList.remove('nasa-highlight-error');
                    }, 2000);

                    const billingDifferent = document.querySelector('#ns-billing-different')?.checked;
                    if (['billing_postcode', 'shipping_postcode'].includes(dataId)) {
                        if (!billingDifferent) {
                            const billingStep = document.querySelector('.nasa-bc-modern .nasa-billing-step');
                            if (billingStep) {
                                billingStep.click();
                            }
                        }
                    }
                }
            }
        });

        if (errorContainer.querySelectorAll('li').length === 0) {
            errorContainer.remove();
        }
    });

    document.querySelectorAll('.woocommerce-error').forEach(container => {
        container.style.display = 'block';
    });
  },
  
  validateFormCheckout: function() {
    const form = document.querySelector('form.checkout');
    if (!form) return false;

    document.querySelectorAll('.nasa-error').forEach(error => error.remove());
    document.querySelectorAll('.form-row').forEach(row => {
        row.classList.remove('nasa-invalid', 'woocommerce-invalid', 'nasa-highlight-error');
    });

    let isValid = true;
    const errorFields = [];
    
    // Validate payment method
    const paymentWrap = document.getElementById('nasa-payment-wrap');
    if (paymentWrap && window.getComputedStyle(paymentWrap).display !== 'none') {
      const paymentMethod = document.querySelector('#payment input[name="payment_method"]:checked');
      if (!paymentMethod) {
        isValid = false;
        const paymentContainer = document.getElementById('payment');
        if (paymentContainer && !paymentContainer.querySelector('.nasa-error')) {
          const errorElement = document.createElement('div');
          errorElement.className = 'nasa-error';
          errorElement.textContent = 'Please choose a payment method';
          paymentContainer.prepend(errorElement);
          errorFields.push(errorElement);
        }
      }
    }
    
    const requiredFields = form.querySelectorAll('.validate-required input:not([type="hidden"]), .validate-required select, .validate-required textarea');
    
    requiredFields.forEach(field => {
        const formRow = field.closest('.form-row');
        if (formRow && formRow.offsetParent !== null) {
            if (!this.validateField(formRow)) {
                isValid = false;
                errorFields.push(field);
            }
        }
    });

    const shipToDifferent = form.querySelector('[name="ship_to_different_address"]') && 
                           form.querySelector('[name="ship_to_different_address"]').checked;
    
    const fieldsContainer = !shipToDifferent ? 
                           form.querySelector('.woocommerce-billing-fields') : 
                           form.querySelector('#customer_details');
    
    const formRows = fieldsContainer ? fieldsContainer.querySelectorAll('.form-row') : [];
    formRows.forEach(row => {
        if (row.offsetParent !== null && !this.validateField(row)) {
            isValid = false;
        }
    });
    
    const contactSection = document.getElementById('ns-checkout-contact');
    if (contactSection) {
        const contactFormRows = contactSection.querySelectorAll('.form-row');
        contactFormRows.forEach(row => {
            if (row.offsetParent !== null && !this.validateField(row)) {
                isValid = false;
            }
        });
    }

    if (!isValid) {
        this.moveValidateNotices();
        this.scrollToFirstError();
        
        errorFields.forEach(field => {
            const formRow = field.closest('.form-row');
            if (formRow) {
                formRow.classList.add('nasa-highlight-error');
                setTimeout(() => formRow.classList.remove('nasa-highlight-error'), 2000);
            }
        });

        if (errorFields.length === 0) {
            const errorHtml = `<ul class="woocommerce-error" role="alert">
                <li>Please fill in all required fields correctly.</li>
            </ul>`;
            form.insertAdjacentHTML('afterbegin', errorHtml);
        }
    }
    
    return isValid;
  },
  
  validateField: function(formRow) {
    if (!formRow) return true;
    
    const input = formRow.querySelector('.input-text') || 
                 formRow.querySelector('select') || 
                 formRow.querySelector('input[type="checkbox"]') ||
                 formRow.querySelector('input[type="radio"]');
                 
    if (!input) return true;
    
    let isValid = true;
    const isRequired = formRow.classList.contains('validate-required');
    const isEmail = formRow.classList.contains('validate-email');
    const isPhone = formRow.classList.contains('validate-phone');
    
    // Skip validation for hidden fields
    if (formRow.offsetParent === null) {
      return true;
    }
    
    formRow.classList.remove('nasa-invalid');
    
    // Validate required fields
    if (isRequired) {
      if (input.type === 'checkbox' && !input.checked) {
        formRow.classList.remove('woocommerce-validated');
        formRow.classList.add('woocommerce-invalid', 'woocommerce-invalid-required-field');
        isValid = false;
        
        if (!formRow.querySelector('.nasa-error')) {
          const errorMessage = document.querySelector('.nasa-require-notice') ? 
                              document.querySelector('.nasa-require-notice').innerHTML : 
                              'This field is required.';
          
          const inputWrapper = input.closest('.woocommerce-input-wrapper');
          if (inputWrapper) {
            inputWrapper.insertAdjacentHTML('beforeend', '<span class="nasa-error">' + errorMessage + '</span>');
          } else {
            input.insertAdjacentHTML('afterend', '<span class="nasa-error">' + errorMessage + '</span>');
          }
        }
      } 
      else if (input.type === 'radio') {
        const groupName = input.name;
        const isSelected = formRow.querySelector(`input[name="${groupName}"]:checked`);
        if (!isSelected) {
          formRow.classList.remove('woocommerce-validated');
          formRow.classList.add('woocommerce-invalid', 'woocommerce-invalid-required-field');
          isValid = false;
          
          if (!formRow.querySelector('.nasa-error')) {
            const errorMessage = document.querySelector('.nasa-require-notice') ? 
                                document.querySelector('.nasa-require-notice').innerHTML : 
                                'Please select an option.';
            
            const inputWrapper = input.closest('.woocommerce-input-wrapper');
            if (inputWrapper) {
              inputWrapper.insertAdjacentHTML('beforeend', '<span class="nasa-error">' + errorMessage + '</span>');
            } else {
              input.insertAdjacentHTML('afterend', '<span class="nasa-error">' + errorMessage + '</span>');
            }
          }
        }
      }
      else if (input.value === '') {
        formRow.classList.remove('woocommerce-validated');
        formRow.classList.add('woocommerce-invalid', 'woocommerce-invalid-required-field');
        isValid = false;
        
        if (!formRow.querySelector('.nasa-error')) {
          const errorMessage = document.querySelector('.nasa-require-notice') ? 
                              document.querySelector('.nasa-require-notice').innerHTML : 
                              'This field is required.';
          
          const inputWrapper = input.closest('.woocommerce-input-wrapper');
          if (inputWrapper) {
            inputWrapper.insertAdjacentHTML('beforeend', '<span class="nasa-error">' + errorMessage + '</span>');
          } else {
            input.insertAdjacentHTML('afterend', '<span class="nasa-error">' + errorMessage + '</span>');
          }
        }
      }
    }
    
    // Validate email
    if (isEmail && input.value) {
      const pattern = /^([a-z\d!#$%&'*+\-\/=?^_`{|}~\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]+(\.[a-z\d!#$%&'*+\-\/=?^_`{|}~\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]+)*|"((([ \t]*\r\n)?[ \t]+)?([\x01-\x08\x0b\x0c\x0e-\x1f\x7f\x21\x23-\x5b\x5d-\x7e\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]|\\[\x01-\x09\x0b\x0c\x0d-\x7f\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))*(([ \t]*\r\n)?[ \t]+)?")@(([a-z\d\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]|[a-z\d\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF][a-z\d\-._~\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]*[a-z\d\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])\.)+([a-z\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]|[a-z\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF][a-z\d\-._~\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]*[0-9a-z\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])\.?$/i;
      
      if (!pattern.test(input.value)) {
        formRow.classList.remove('woocommerce-validated');
        formRow.classList.add('woocommerce-invalid', 'woocommerce-invalid-email', 'woocommerce-invalid-phone');
        isValid = false;
        
        if (!formRow.querySelector('.nasa-error')) {
          const errorMessage = document.querySelector('.nasa-email-notice') ? 
                              document.querySelector('.nasa-email-notice').innerHTML : 
                              'Please enter a valid email address.';
          
          input.insertAdjacentHTML('afterend', '<span class="nasa-error">' + errorMessage + '</span>');
        }
      }
    }
    
    // Validate phone
    if (isPhone) {
      const pattern = /[\s\#0-9_\-\+\/\(\)\.]/g;
      
      if (input.value.replace(pattern, '').length > 0) {
        formRow.classList.remove('woocommerce-validated');
        formRow.classList.add('woocommerce-invalid', 'woocommerce-invalid-phone');
        isValid = false;
        
        if (!formRow.querySelector('.nasa-error')) {
          const errorMessage = document.querySelector('.nasa-phone-notice') ? 
                              document.querySelector('.nasa-phone-notice').innerHTML : 
                              'Please enter a valid phone number.';
          
          input.insertAdjacentHTML('afterend', '<span class="nasa-error">' + errorMessage + '</span>');
        }
      }
    }
    
    if (isValid) {
      formRow.classList.remove('woocommerce-invalid', 'woocommerce-invalid-required-field', 'woocommerce-invalid-email', 'woocommerce-invalid-phone');
      formRow.classList.add('woocommerce-validated');
    } else {
      formRow.classList.add('nasa-invalid');
    }
    
    return isValid;
  },
  
  scrollToFirstError: function() {
    const firstError = document.querySelector('.woocommerce-error li[data-id], .nasa-error, .nasa-invalid');
    if (firstError) {
      const errorElement = document.getElementById(firstError.getAttribute('data-id')) || 
                         firstError.closest('.form-row') || 
                         firstError;
      
      errorElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
      
      setTimeout(() => {
        const input = errorElement.querySelector('input, select, textarea');
        if (input) {
          input.focus();
          const formRow = input.closest('.form-row');
          if (formRow) {
            formRow.classList.add('nasa-highlight-error');
            setTimeout(() => formRow.classList.remove('nasa-highlight-error'), 2000);
          }
        }
      }, 500);
    }
  },
  
  validateFormCheckoutPost: function() {
    const form = document.querySelector('form.checkout');
    if (!form) return false;
    
    if (form.classList.contains('ns-validating') || form.classList.contains('ns-validated-first')) {
      return;
    }
    
    if (typeof nasa_ajax_params !== 'undefined' && typeof nasa_ajax_params.wc_ajax_url !== 'undefined') {
      const url = nasa_ajax_params.wc_ajax_url.toString().replace('%%endpoint%%', 'nasa_validate_checkout_modern');
      
      const formData = new FormData(form);
      const serialized = new URLSearchParams(formData).toString();
      
      form.classList.add('ns-validating');
      
      const errorMessages = document.querySelectorAll('.woocommerce-billing-fields .nasa-error, .woocommerce-shipping-fields .nasa-error, .ns-shipping-first .woocommerce-shipping-fields .nasa-error');
      errorMessages.forEach(error => error.remove());
      
      AJAXHelper.post(url, serialized, (result) => {
        form.classList.remove('ns-validating');
        
        if (result.result === 'failure') {
          if (result.messages) {
            const hiddenErrors = document.querySelectorAll('.woocommerce-billing-fields .nasa-error, .woocommerce-shipping-fields .nasa-error, .ns-shipping-first .woocommerce-shipping-fields .nasa-error');
            hiddenErrors.forEach(error => {
              const formRow = error.closest('.form-row');
              if (formRow && formRow.style.display === 'none') {
                formRow.classList.remove('woocommerce-invalid');
                error.remove();
              }
            });
            
            if (document.querySelectorAll('.woocommerce-billing-fields .nasa-error, .woocommerce-shipping-fields .nasa-error, .ns-shipping-first .woocommerce-shipping-fields .nasa-error').length) {
              document.querySelectorAll('.woocommerce-NoticeGroup-checkout, .woocommerce-error, .woocommerce-message').forEach(notice => notice.remove());
              form.insertAdjacentHTML('afterbegin', '<div class="woocommerce-NoticeGroup woocommerce-NoticeGroup-checkout">' + result.messages + '</div>');
              
              const errorEvent = new CustomEvent('checkout_error', { detail: result.messages });
              document.body.dispatchEvent(errorEvent);
              
              if (document.querySelectorAll('.woocommerce-shipping-fields .nasa-error').length) {
                if (document.querySelector('.ns-shipping-first') || 
                    (document.querySelector('input[name="ship_to_different_address"]') && 
                     document.querySelector('input[name="ship_to_different_address"]').checked)) {
                  document.querySelector('.nasa-billing-step')?.click();
                }
              }
              
              if (document.querySelectorAll('.woocommerce-billing-fields .nasa-error').length) {
                const billingDifferent = document.querySelector('input#ns-billing-different');
                if (billingDifferent && billingDifferent.checked) {
                  document.querySelector('.nasa-payment-step')?.click();
                } else {
                  document.querySelector('.nasa-billing-step')?.click();
                }
              }
            } else {
              form.classList.add('ns-validated-first');
              document.querySelectorAll('.woocommerce-NoticeGroup-checkout, .woocommerce-error, .woocommerce-message').forEach(notice => notice.remove());
            }
          }
        } else {
          form.classList.add('ns-validated-first');
          document.querySelectorAll('.woocommerce-NoticeGroup-checkout, .woocommerce-error, .woocommerce-message').forEach(notice => notice.remove());
        }
      }, () => {
        form.classList.remove('ns-validating');
      });
    }
  },
  
  updateCheckoutContactInfo: function() {
    const checkoutModernWrap = document.querySelector('.checkout-modern-wrap');
    if (!checkoutModernWrap) return;
    
    const checkoutContact = document.getElementById('ns-checkout-contact');
    if (checkoutContact) {
      const billingEmailField = document.getElementById('billing_email_field');
      const nasaEmailField = document.querySelector('.nasa-email-field');
      
      if (billingEmailField && nasaEmailField) {
        nasaEmailField.replaceWith(billingEmailField);
      }
      
      const accountFields = document.querySelector('#customer_details .woocommerce-account-fields');
      const formRowWrap = document.querySelector('#ns-checkout-contact .form-row-wrap');
      
      if (accountFields && formRowWrap) {
        formRowWrap.appendChild(accountFields);
      }
    }
    
    const billingCompanyField = document.getElementById('billing_company_field');
    if (billingCompanyField && !billingCompanyField.classList.contains('validate-required')) {
      const label = billingCompanyField.querySelector('label');
      if (label) {
        const labelText = label.textContent;
        const addFieldHtml = `<p class="form-row form-row-wide no-underline form-row-add-field">
                              <a class="add-field nasa-flex" data-target="billing_company_field" href="javascript:void(0);">
                                <i class="pe-7s-plus"></i>&nbsp;${labelText}
                              </a>
                            </p>`;
        
        billingCompanyField.insertAdjacentHTML('beforebegin', addFieldHtml);
      }
    }
    
    const shippingCompanyField = document.getElementById('shipping_company_field');
    if (shippingCompanyField && !shippingCompanyField.classList.contains('validate-required')) {
      const label = shippingCompanyField.querySelector('label');
      if (label) {
        const labelText = label.textContent;
        const addFieldHtml = `<p class="form-row form-row-wide no-underline form-row-add-field">
                              <a class="add-field nasa-flex" data-target="shipping_company_field" href="javascript:void(0);">
                                <i class="pe-7s-plus"></i>&nbsp;${labelText}
                              </a>
                            </p>`;
        
        shippingCompanyField.insertAdjacentHTML('beforebegin', addFieldHtml);
      }
    }
    
    const nsShippingFirst = document.querySelector('.ns-shipping-first .woocommerce-billing-fields');
    const billingDetailWrap = document.querySelector('#nasa-billing-detail-wrap .woocommerce-billing-fields');
    
    if (nsShippingFirst && billingDetailWrap) {
      billingDetailWrap.replaceWith(nsShippingFirst);
      
      const event = new CustomEvent('country_to_state_changed');
      document.body.dispatchEvent(event);
    }
  }
};

// DOM Helper utilities
const DOMHelper = {
  slideDown: function(element, duration = 300) {
    element.style.display = '';
    element.style.overflow = 'hidden';
    element.style.height = '0';
    element.style.transition = `height ${duration}ms ease`;
    
    const fullHeight = element.scrollHeight + 'px';
    element.style.height = fullHeight;
    
    setTimeout(() => {
      element.style.height = '';
      element.style.overflow = '';
      element.style.transition = '';
    }, duration);
  },
  
  slideUp: function(element, duration = 300) {
    element.style.overflow = 'hidden';
    element.style.height = element.scrollHeight + 'px';
    element.style.transition = `height ${duration}ms ease`;
    
    setTimeout(() => {
      element.style.height = '0';
    }, 10);
    
    setTimeout(() => {
      element.style.display = 'none';
      element.style.height = '';
      element.style.overflow = '';
      element.style.transition = '';
    }, duration);
  }
};

// AJAX Helper utilities
const AJAXHelper = {
  post: function(url, data, success, error) {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
    
    xhr.onload = function() {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          success(response);
        } catch (e) {
          console.error('Error parsing response:', e);
          if (error) error();
        }
      } else if (error) {
        error();
      }
    };
    
    xhr.onerror = function() {
      if (error) error();
    };
    
    xhr.send(data);
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  const checkWooReady = setInterval(() => {
    if (typeof wc_checkout_params !== 'undefined') {
      clearInterval(checkWooReady);
      CheckoutHandler.init();
    }
  }, 100);
});
