$(document).ready(function () {
    // Mobile menu toggle
    $('.menu-toggle').on('click', function() {
        $('.calculator-tabs').toggleClass('active');
        $(this).toggleClass('active');
    });

    // Close mobile menu when clicking outside
    $(document).on('click', function(e) {
        if (!$(e.target).closest('.calculator-tabs, .menu-toggle').length) {
            $('.calculator-tabs').removeClass('active');
            $('.menu-toggle').removeClass('active');
        }
    });

    // Initial values
    const initialValues = {
        location: 'Toronto, ON',
        province: 'Ontario',
        city: 'Toronto',
        purchasePrice: 888000,
        downPayment: 63800,
        downPaymentPercentage: 7.15,
        amortizationYears: 25,
        amortizationMonths: 0,
        interestRate: 5.99,
        appraisal: 0,
        homeInspection: 0,
        movingCosts: 0,
        titleInsurance: 350,
        legalFees: 0,
        taxAdjustments: 0,
        lenderFee: 0,
        brokerageFee: 0,
        waterTest: 0,
        septicInspection: 0,
        surveyFee: 0,
        realEstateLawyer: 1500,
        isNewlyBuiltHome: false,
        isFirstTimeHomebuyer: false,
        isForeignBuyer: false
    };

    // Define slider ranges
    const minPurchasePrice = 100000;
    const maxPurchasePrice = 5000000;
    const minDownPaymentPercentage = 5;
    const maxDownPaymentPercentage = 50;
    const minAmortization = 5;
    const maxAmortization = 30;
    const minInterestRate = 1;
    const maxInterestRate = 10;

    // Define ancillary cost ranges
    const costRanges = {
        appraisal: { min: 0, max: 1000 },
        homeInspection: { min: 0, max: 1000 },
        movingCosts: { min: 0, max: 5000 },
        titleInsurance: { min: 0, max: 1000 },
        legalFees: { min: 0, max: 2500 },
        taxAdjustments: { min: 0, max: 2000 },
        lenderFee: { min: 0, max: 1200 },
        brokerageFee: { min: 0, max: 3000 },
        waterTest: { min: 0, max: 300 },
        septicInspection: { min: 0, max: 500 },
        surveyFee: { min: 0, max: 1000 },
        realEstateLawyer: { min: 1000, max: 3000 }
    };

    // Land Transfer Tax Rates (example rates - these would be accurate for actual locations)
    const provincialTaxRates = {
        'Ontario': [
            { threshold: 250000, rate: 0.005 },
            { threshold: 400000, rate: 0.01 },
            { threshold: 2000000, rate: 0.015 },
            { threshold: Infinity, rate: 0.02 }
        ]
    };

    const municipalTaxRates = {
        'Toronto': [
            { threshold: 55000, rate: 0.005 },
            { threshold: 250000, rate: 0.01 },
            { threshold: 400000, rate: 0.015 },
            { threshold: 2000000, rate: 0.02 },
            { threshold: Infinity, rate: 0.025 }
        ]
    };

    // Rebate Information
    const rebates = {
        firstTimeHomeBuyer: {
            'Ontario': { max: 4000, threshold: 368000 },
            'Toronto': { max: 4475, threshold: 400000 }
        },
        newlyBuiltHome: {
            'Ontario': { max: 24000, threshold: 400000 }
        }
    };

    // Location data - mapping from location to province and city
    const locationData = {
        'Toronto, ON': { province: 'Ontario', city: 'Toronto' },
        'Vancouver, BC': { province: 'British Columbia', city: 'Vancouver' },
        'Calgary, AB': { province: 'Alberta', city: 'Calgary' },
        'Montreal, QC': { province: 'Quebec', city: 'Montreal' },
        'Ottawa, ON': { province: 'Ontario', city: 'Ottawa' },
        'Edmonton, AB': { province: 'Alberta', city: 'Edmonton' },
        'Winnipeg, MB': { province: 'Manitoba', city: 'Winnipeg' },
        'Halifax, NS': { province: 'Nova Scotia', city: 'Halifax' }
    };

    // Format currency
    function formatCurrency(amount) {
        return '$' + new Intl.NumberFormat('en-US', {
            maximumFractionDigits: 0
        }).format(amount);
    }

    // Format decimal with dollar sign
    function formatDecimal(amount) {
        return '$' + new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }

    // Format percentage
    function formatPercentage(percentage) {
        return percentage.toFixed(2) + '%';
    }

    // Parse currency input 
    function parseCurrency(value) {
        if (typeof value === 'string') {
            return parseFloat(value.replace(/[$,]/g, ''));
        }
        return value;
    }

    // Setup the interest rate input functionality
    function setupInterestRateInput() {
        initializeInterestRateInput();
    }

    // Calculate Provincial Land Transfer Tax
    function calculateProvincialTax(price, isFirstTimeBuyer, isNewlyBuilt) {
        let tax = 0;
        
        // Ontario provincial tax rates
        if (price <= 55000) {
            tax = price * 0.005;
        } else if (price <= 250000) {
            tax = 275 + ((price - 55000) * 0.01);
        } else if (price <= 400000) {
            tax = 2225 + ((price - 250000) * 0.015);
        } else if (price <= 2000000) {
            tax = 4475 + ((price - 400000) * 0.02);
        } else {
            tax = 36475 + ((price - 2000000) * 0.025);
        }

        // Apply first-time homebuyer rebate if applicable
        if (isFirstTimeBuyer && price <= 400000) {
            const rebate = Math.min(tax, 4000);
            tax = Math.max(0, tax - rebate);
        }

        // Apply newly built home rebate if applicable
        if (isNewlyBuilt && price <= 400000) {
            const rebate = Math.min(tax, 24000);
            tax = Math.max(0, tax - rebate);
        }

        return Math.round(tax);
    }

    // Calculate Municipal Land Transfer Tax
    function calculateMunicipalTax(price, isFirstTimeBuyer) {
        let tax = 0;
        
        // Toronto municipal tax rates
        if (price <= 55000) {
            tax = price * 0.005;
        } else if (price <= 250000) {
            tax = 275 + ((price - 55000) * 0.01);
        } else if (price <= 400000) {
            tax = 2225 + ((price - 250000) * 0.015);
        } else if (price <= 2000000) {
            tax = 4475 + ((price - 400000) * 0.02);
        } else {
            tax = 36475 + ((price - 2000000) * 0.025);
        }

        // Apply first-time homebuyer rebate if applicable
        if (isFirstTimeBuyer && price <= 400000) {
            const rebate = Math.min(tax, 4475);
            tax = Math.max(0, tax - rebate);
        }

        return Math.round(tax);
    }

    // Calculate total rebates
    function calculateTotalRebates(price, isFirstTimeBuyer, isNewlyBuilt) {
        let totalRebate = 0;

        // Provincial rebate
        if (isFirstTimeBuyer && price <= 400000) {
            totalRebate += 4000;
        }

        // Municipal rebate
        if (isFirstTimeBuyer && price <= 400000) {
            totalRebate += 4475;
        }

        // Newly built home rebate
        if (isNewlyBuilt && price <= 400000) {
            totalRebate += 24000;
        }

        return totalRebate;
    }

    // Calculate CMHC Insurance and PST on Insurance
    function calculateMortgageInsurance(price, downPaymentPercentage) {
        if (downPaymentPercentage >= 20) {
            return { insurance: 0, pst: 0 };
        }

        const loanAmount = price * (1 - downPaymentPercentage / 100);
        let rate = 0;

        if (downPaymentPercentage >= 5 && downPaymentPercentage < 10) {
            rate = 0.04;
        } else if (downPaymentPercentage >= 10 && downPaymentPercentage < 15) {
            rate = 0.031;
        } else if (downPaymentPercentage >= 15 && downPaymentPercentage < 20) {
            rate = 0.028;
        }

        const insurance = loanAmount * rate;
        const pst = insurance * 0.08; // 8% PST on insurance in Ontario

        return { insurance, pst: Math.round(pst) };
    }

    // Animation function for smooth transitions with acceleration
    function animateValue(element, start, end, duration, isDecimal = false, prefix = '') {
        // Add highlighting class
        $(element).addClass('value-changing');

        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            
            // Use easeOutQuart easing function for acceleration effect
            const easedProgress = 1 - Math.pow(1 - progress, 4);
            
            // Calculate current value
            const current = start + easedProgress * (end - start);

            // Format appropriately
            if (isDecimal) {
                $(element).text(prefix + formatDecimal(current));
            } else {
                $(element).text(prefix + formatCurrency(current));
            }

            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                // Remove highlighting when done
                setTimeout(() => {
                    $(element).removeClass('value-changing');
                }, 200);
            }
        };
        window.requestAnimationFrame(step);
    }

    // Update Purchase Price Slider
    function updatePurchasePriceSlider(price) {
        const percentage = (price - minPurchasePrice) / (maxPurchasePrice - minPurchasePrice);
        $('.price-slider .slider-track').css('width', (percentage * 100) + '%');
        $('.price-slider .slider-thumb').css('left', (percentage * 100) + '%');
    }

    // Update Down Payment Slider
    function updateDownPaymentSlider(percentage) {
        const sliderPercentage = (percentage - minDownPaymentPercentage) / (maxDownPaymentPercentage - minDownPaymentPercentage);
        $('.down-payment-slider .slider-track').css('width', (sliderPercentage * 100) + '%');
        $('.down-payment-slider .slider-thumb').css('left', (sliderPercentage * 100) + '%');
    }

    // Update Amortization Slider
    function updateAmortizationSlider(years) {
        const percentage = (years - minAmortization) / (maxAmortization - minAmortization);
        $('.amortization-slider .slider-track').css('width', (percentage * 100) + '%');
        $('.amortization-slider .slider-thumb').css('left', (percentage * 100) + '%');
    }

    // Update Interest Rate Slider
    function updateInterestRateSlider(rate) {
        const percentage = (rate - minInterestRate) / (maxInterestRate - minInterestRate);
        $('.interest-rate-slider .slider-track').css('width', (percentage * 100) + '%');
        $('.interest-rate-slider .slider-thumb').css('left', (percentage * 100) + '%');
    }

    // Update Cost Slider
    function updateCostSlider(costType, value) {
        const range = costRanges[costType];
        if (!range) return;
        
        // Convert camelCase to kebab-case for CSS selector
        const cssSelector = costType.replace(/([A-Z])/g, '-$1').toLowerCase();
        
        const percentage = (value - range.min) / (range.max - range.min);
        $(`.${cssSelector}-slider .slider-track`).css('width', (percentage * 100) + '%');
        $(`.${cssSelector}-slider .slider-thumb`).css('left', (percentage * 100) + '%');
    }

    // Handle Cost Slider Interaction
    function handleCostSlider(e, costType) {
        const range = costRanges[costType];
        if (!range) return;
        
        // Convert camelCase to kebab-case for CSS selector
        const cssSelector = costType.replace(/([A-Z])/g, '-$1').toLowerCase();
        
        const sliderElement = $(`.${cssSelector}-slider`);
        const sliderWidth = sliderElement.width();
        let clickPosition = e.pageX - sliderElement.offset().left;

        // Constrain within slider bounds
        clickPosition = Math.max(0, Math.min(clickPosition, sliderWidth));
        const percentage = clickPosition / sliderWidth;

        // Update slider visually
        $(`.${cssSelector}-slider .slider-track`).css('width', (percentage * 100) + '%');
        $(`.${cssSelector}-slider .slider-thumb`).css('left', (percentage * 100) + '%');

        // Calculate new cost value
        const newValue = Math.round(range.min + (range.max - range.min) * percentage);
        
        // Update cost input - convert back to kebab-case for the ID
        $(`#${cssSelector}`).val(formatCurrency(newValue));

        // Update calculator
        updateCalculator();
    }

    // Purchase Price Slider Interaction
    function handlePurchasePriceSlider(e) {
        const sliderElement = $('.purchase-slider');
        const sliderWidth = sliderElement.width();
        let clickPosition = e.pageX - sliderElement.offset().left;

        // Constrain within slider bounds
        clickPosition = Math.max(0, Math.min(clickPosition, sliderWidth));
        const percentage = clickPosition / sliderWidth;

        // Update slider visually
        $('.purchase-slider .slider-track').css('width', (percentage * 100) + '%');
        $('.purchase-slider .slider-thumb').css('left', (percentage * 100) + '%');

        // Calculate new price
        const newPrice = Math.round((minPurchasePrice + (maxPurchasePrice - minPurchasePrice) * percentage) / 1000) * 1000;

        // Update price input
        $('#purchase-price').val(formatCurrency(newPrice));

        // Update calculator
        updateCalculator();
    }

    // Down Payment Slider Interaction
    function handleDownPaymentSlider(e) {
        const sliderElement = $('.down-payment-slider');
        const sliderWidth = sliderElement.width();
        let clickPosition = e.pageX - sliderElement.offset().left;

        // Constrain within slider bounds
        clickPosition = Math.max(0, Math.min(clickPosition, sliderWidth));
        const percentage = clickPosition / sliderWidth;

        // Update slider visually
        $('.down-payment-slider .slider-track').css('width', (percentage * 100) + '%');
        $('.down-payment-slider .slider-thumb').css('left', (percentage * 100) + '%');

        // Calculate new down payment percentage
        const newPercentage = minDownPaymentPercentage + (maxDownPaymentPercentage - minDownPaymentPercentage) * percentage;
        
        // Update down payment percentage display
        $('.percentage').text(formatPercentage(newPercentage));
        
        // Calculate down payment amount based on percentage
        const purchasePrice = parseFloat($('#purchase-price').val().replace(/[^0-9.-]+/g, '')) || initialValues.purchasePrice;
        const newDownPayment = Math.round(purchasePrice * (newPercentage / 100));
        
        // Update down payment input
        $('#down-payment').val(formatCurrency(newDownPayment));

        // Update calculator
        updateCalculator();
    }

    // Amortization Slider Interaction
    function handleAmortizationSlider(e) {
        const sliderElement = $('.amortization-slider');
        const sliderWidth = sliderElement.width();
        let clickPosition = e.pageX - sliderElement.offset().left;

        // Constrain within slider bounds
        clickPosition = Math.max(0, Math.min(clickPosition, sliderWidth));
        const percentage = clickPosition / sliderWidth;

        // Update slider visually
        $('.amortization-slider .slider-track').css('width', (percentage * 100) + '%');
        $('.amortization-slider .slider-thumb').css('left', (percentage * 100) + '%');

        // Calculate new amortization period
        const newYears = Math.min(maxAmortization, Math.max(minAmortization, Math.round(minAmortization + (maxAmortization - minAmortization) * percentage)));
        
        // Update amortization inputs
        $('#amortization-years').val(newYears);
        $('#amortization-months').val(0);
        
        // Force direct update of the amortization display in results section using DOM API
        document.querySelector('.amortization-period .result-value').textContent = `${newYears} years`;

        // Update calculator
        updateCalculator();
    }

    // Handle Interest Rate Slider Interaction
    function handleInterestRateSlider(e) {
        const sliderElement = $('.interest-rate-slider');
        const sliderWidth = sliderElement.width();
        let clickPosition = e.pageX - sliderElement.offset().left;

        // Constrain within slider bounds
        clickPosition = Math.max(0, Math.min(clickPosition, sliderWidth));
        const percentage = clickPosition / sliderWidth;

        // Update slider visually
        $('.interest-rate-slider .slider-track').css('width', (percentage * 100) + '%');
        $('.interest-rate-slider .slider-thumb').css('left', (percentage * 100) + '%');

        // Calculate new interest rate (with 2 decimal precision)
        const newRate = parseFloat((minInterestRate + (maxInterestRate - minInterestRate) * percentage).toFixed(2));
        
        // Update interest rate input
        $('#interest-rate').val(newRate + '%');

        // Update calculator
        updateCalculator();
    }

    // Initialize values and sliders
    function initializeInputs() {
        // Set initial input values
        $('#location').val(initialValues.location);
        $('#purchase-price').val(formatCurrency(initialValues.purchasePrice));
        $('#down-payment').val(formatCurrency(initialValues.downPayment));
        $('.percentage').text(formatPercentage(initialValues.downPaymentPercentage));
        $('#amortization-years').val(initialValues.amortizationYears);
        $('#amortization-months').val(initialValues.amortizationMonths);
        $('#interest-rate').val(initialValues.interestRate + '%');
        
        // Set initial amortization display using direct DOM manipulation
        const amortizationDisplay = 
            initialValues.amortizationMonths > 0 
                ? `${initialValues.amortizationYears} years ${initialValues.amortizationMonths} months` 
                : `${initialValues.amortizationYears} years`;
        document.querySelector('.amortization-period .result-value').textContent = amortizationDisplay;
        
        // Explicitly set values for all ancillary costs to $0 as shown in the image
        $('#appraisal').val('$0');
        $('#home-inspection').val('$0');
        $('#moving-costs').val('$0');
        $('#title-insurance').val('$0');
        $('#legal-fees').val('$0');
        $('#tax-adjustments').val('$0');
        $('#lender-fee').val('$0');
        $('#brokerage-fee').val('$0');
        
        // Set checkbox states
        $('#newly-built-home').prop('checked', initialValues.isNewlyBuiltHome);
        $('#first-time-homebuyer').prop('checked', initialValues.isFirstTimeHomebuyer);
        $('#foreign-buyer').prop('checked', initialValues.isForeignBuyer);
    }

    // Initialize slider positions
    function initializeSliders() {
        updatePurchasePriceSlider(initialValues.purchasePrice);
        updateDownPaymentSlider(initialValues.downPaymentPercentage);
        updateAmortizationSlider(initialValues.amortizationYears);
        updateInterestRateSlider(initialValues.interestRate);
        
        // Initialize all cost sliders with explicit values
        Object.keys(costRanges).forEach(costType => {
            const value = initialValues[costType] || 0;
            updateCostSlider(costType, value);
            
            // Convert camelCase to kebab-case for the input ID
            const cssSelector = costType.replace(/([A-Z])/g, '-$1').toLowerCase();
            
            // Make sure the input displays the correct value
            $(`#${cssSelector}`).val(formatCurrency(value));
        });

        // Force a redraw of the sliders to ensure they are displayed correctly
        setTimeout(() => {
            $('.slider-track, .slider-thumb').css('transition', 'none');
            $('.slider-track, .slider-thumb').each(function() {
                $(this)[0].offsetHeight; // Force a reflow
            });
            $('.slider-track, .slider-thumb').css('transition', '');
        }, 10);
    }

    // Update calculator with current values
    function updateCalculator() {
        // Get current input values
        const purchasePrice = parseFloat($('#purchase-price').val().replace(/[^0-9.-]+/g, '')) || initialValues.purchasePrice;
        const downPayment = parseFloat($('#down-payment').val().replace(/[^0-9.-]+/g, '')) || initialValues.downPayment;
        const downPaymentPercentage = (downPayment / purchasePrice) * 100;
        const interestRate = parseFloat($('#interest-rate').val().replace(/[^0-9.-]+/g, '')) || initialValues.interestRate;
        const amortizationYears = parseInt($('#amortization-years').val()) || initialValues.amortizationYears;
        const amortizationMonths = parseInt($('#amortization-months').val()) || initialValues.amortizationMonths;
        
        // Get checkbox values
        const isFirstTimeBuyer = $('#first-time-homebuyer').prop('checked');
        const isNewlyBuiltHome = $('#newly-built-home').prop('checked');
        const isForeignBuyer = $('#foreign-buyer').prop('checked');

        // Calculate taxes
        const provincialTax = calculateProvincialTax(purchasePrice, isFirstTimeBuyer, isNewlyBuiltHome);
        const municipalTax = calculateMunicipalTax(purchasePrice, isFirstTimeBuyer);
        const totalRebates = calculateTotalRebates(purchasePrice, isFirstTimeBuyer, isNewlyBuiltHome);
        
        // Calculate mortgage insurance
        const mortgageInsurance = calculateMortgageInsurance(purchasePrice, downPaymentPercentage);
        
        // Calculate ancillary costs
        const ancillaryCosts = calculateAncillaryCosts();
        
        // Calculate potential interest costs for first term (first year as an estimate)
        const mortgageAmount = purchasePrice - downPayment;
        const monthlyInterestRate = interestRate / 100 / 12;
        const totalMonths = 12; // First year estimate
        const interestCostFirstYear = mortgageAmount * monthlyInterestRate * totalMonths;
        
        // Calculate total closing costs (now including interest)
        const landTransferTax = provincialTax + municipalTax;
        const totalClosingCosts = landTransferTax + mortgageInsurance.pst + ancillaryCosts;

        // Update percentage display
        $('.percentage').text(formatPercentage(downPaymentPercentage));

        // Update amortization period display - use direct DOM manipulation for reliability
        const amortizationDisplay = 
            amortizationMonths > 0 
                ? `${amortizationYears} years ${amortizationMonths} months` 
                : `${amortizationYears} years`;
        document.querySelector('.amortization-period .result-value').textContent = amortizationDisplay;

        // Get current displayed values for animation
        const currentTotalCosts = parseFloat($('.result-amount').text().replace(/[^0-9.-]+/g, '')) || 0;
        const currentLandTransfer = parseFloat($('.land-transfer .result-value').text().replace(/[^0-9.-]+/g, '')) || 0;
        const currentProvincial = parseFloat($('.breakdown-item:eq(0) .breakdown-value').text().replace(/[^0-9.-]+/g, '')) || 0;
        const currentMunicipal = parseFloat($('.breakdown-item:eq(1) .breakdown-value').text().replace(/[^0-9.-]+/g, '')) || 0;
        const currentRebates = parseFloat($('.breakdown-item:eq(2) .breakdown-value').text().replace(/[^0-9.-]+/g, '')) || 0;
        const currentPST = parseFloat($('.mortgage-insurance .result-value').text().replace(/[^0-9.-]+/g, '')) || 0;
        const currentAncillary = parseFloat($('.ancillary-cost .result-value').text().replace(/[^0-9.-]+/g, '')) || 0;

        // Animation duration
        const animationDuration = 800;

        // Animate value updates
        animateValue($('.result-amount'), currentTotalCosts, totalClosingCosts, animationDuration);
        animateValue($('.land-transfer .result-value'), currentLandTransfer, landTransferTax, animationDuration, false, '+ ');
        animateValue($('.breakdown-item:eq(0) .breakdown-value'), currentProvincial, provincialTax, animationDuration, false, '+ ');
        animateValue($('.breakdown-item:eq(1) .breakdown-value'), currentMunicipal, municipalTax, animationDuration, false, '+ ');
        animateValue($('.breakdown-item:eq(2) .breakdown-value'), currentRebates, totalRebates, animationDuration);
        animateValue($('.mortgage-insurance .result-value'), currentPST, mortgageInsurance.pst, animationDuration);
        animateValue($('.ancillary-cost .result-value'), currentAncillary, ancillaryCosts, animationDuration);

        // Update result title to include interest rate
        $('.result-header .result-title').text(`Total Estimated Cost (${interestRate}%)`);
    }

    // Calculate total ancillary costs
    function calculateAncillaryCosts() {
        let total = 0;
        
        // Sum all ancillary costs
        Object.keys(costRanges).forEach(costType => {
            // Convert camelCase to kebab-case for the ID selector
            const cssSelector = costType.replace(/([A-Z])/g, '-$1').toLowerCase();
            const inputElement = $(`#${cssSelector}`);
            
            if (inputElement.length) {
                const value = parseFloat(inputElement.val().replace(/[^0-9.-]+/g, '')) || 0;
                total += value;
                
                // Ensure the input shows a valid value
                if (inputElement.val() === '' || isNaN(parseFloat(inputElement.val().replace(/[^0-9.-]+/g, '')))) {
                    inputElement.val('$0');
                }
            }
        });
        
        return total;
    }

    // Initialize fixed results position
    function setupFixedResults() {
        const resultsBoxContainer = $('.results-box-container');
        const fixedResultsBox = $('.fixed-results-box');
        const initialTop = resultsBoxContainer.offset().top;
        const initialLeft = resultsBoxContainer.offset().left;
        const containerWidth = resultsBoxContainer.width();

        // Handle scroll event
        $(window).on('scroll', function() {
            const scrollTop = $(window).scrollTop();
            const windowHeight = $(window).height();
            const boxHeight = fixedResultsBox.outerHeight();

            // Check if window is wide enough for fixed position
            if ($(window).width() <= 992) {
                // On mobile or tablet, keep in normal flow
                fixedResultsBox.removeClass('fixed');
                fixedResultsBox.css({
                    position: 'relative',
                    top: '0',
                    left: '0',
                    width: '100%'
                });
                return;
            }

            // Check if box is too tall for viewport
            if (boxHeight > windowHeight - 40) {
                // Box is too tall, keep in normal flow
                fixedResultsBox.removeClass('fixed');
                fixedResultsBox.css({
                    position: 'relative',
                    top: '0',
                    left: '0'
                });
            } else if (scrollTop + 20 > initialTop) {
                // Fix position when scrolled past initial position
                fixedResultsBox.addClass('fixed');
                fixedResultsBox.css({
                    position: 'fixed',
                    top: '20px',
                    left: initialLeft + 'px',
                    width: containerWidth + 'px'
                });
            } else {
                // Return to normal flow
                fixedResultsBox.removeClass('fixed');
                fixedResultsBox.css({
                    position: 'relative',
                    top: '0',
                    left: '0'
                });
            }
        });

        // Handle resize event
        $(window).on('resize', function() {
            const newLeft = resultsBoxContainer.offset().left;
            const newWidth = resultsBoxContainer.width();

            if (fixedResultsBox.hasClass('fixed')) {
                fixedResultsBox.css({
                    left: newLeft + 'px',
                    width: newWidth + 'px'
                });
            }

            // On mobile or tablet, reset to normal flow
            if ($(window).width() <= 992) {
                fixedResultsBox.removeClass('fixed');
                fixedResultsBox.css({
                    position: 'relative',
                    top: '0',
                    left: '0',
                    width: '100%'
                });
            }
        });
    }

    // Bind event listeners for Purchase Price slider
    $('.purchase-slider').on('mousedown', function(e) {
        handlePurchasePriceSlider(e);
        $(document).on('mousemove', handlePurchasePriceSlider);
        $(document).on('mouseup', function() {
            $(document).off('mousemove mouseup');
        });
    });

    // Bind event listeners for Down Payment slider
    $('.down-payment-slider').on('mousedown', function(e) {
        handleDownPaymentSlider(e);
        $(document).on('mousemove', handleDownPaymentSlider);
        $(document).on('mouseup', function() {
            $(document).off('mousemove mouseup');
        });
    });

    // Bind event listeners for Amortization slider
    $('.amortization-slider').on('mousedown', function(e) {
        handleAmortizationSlider(e);
        $(document).on('mousemove', handleAmortizationSlider);
        $(document).on('mouseup', function() {
            $(document).off('mousemove mouseup');
        });
    });

    // Bind event listeners for Interest Rate slider
    $('.interest-rate-slider').on('mousedown', function(e) {
        handleInterestRateSlider(e);
        $(document).on('mousemove', handleInterestRateSlider);
        $(document).on('mouseup', function() {
            $(document).off('mousemove mouseup');
        });
    });

    // Bind event listeners for all cost sliders
    $('.cost-slider').on('mousedown', function(e) {
        const sliderClass = $(this).attr('class').split(' ')[1].replace('-slider', '');
        // Convert kebab-case to camelCase (e.g., "home-inspection" -> "homeInspection")
        const costType = sliderClass.replace(/-([a-z])/g, function(match, letter) {
            return letter.toUpperCase();
        });
        
        if (costRanges[costType]) {
            handleCostSlider(e, costType);
            
            $(document).on(`mousemove.${costType}slider`, function(evt) {
                handleCostSlider(evt, costType);
            });
            
            $(document).on(`mouseup.${costType}slider`, function() {
                $(document).off(`mousemove.${costType}slider mouseup.${costType}slider`);
            });
        }
    });

    // Handle Purchase Price input changes
    $('#purchase-price').on('input', function() {
        let value = $(this).val().replace(/[^0-9.-]+/g, '');
        if (value) {
            value = parseInt(value);
            value = Math.max(minPurchasePrice, Math.min(value, maxPurchasePrice));
            
            $(this).val(formatCurrency(value));
            updatePurchasePriceSlider(value);
            
            // Update down payment to maintain percentage
            const downPaymentPercentage = parseFloat($('.percentage').text());
            const newDownPayment = Math.round(value * (downPaymentPercentage / 100));
            $('#down-payment').val(formatCurrency(newDownPayment));
            
            updateCalculator();
        }
    });

    // Handle Down Payment input changes
    $('#down-payment').on('input', function() {
        let value = $(this).val().replace(/[^0-9.-]+/g, '');
        if (value) {
            value = parseInt(value);
            const purchasePrice = parseFloat($('#purchase-price').val().replace(/[^0-9.-]+/g, '')) || initialValues.purchasePrice;
            
            // Calculate percentage and constrain to valid range
            let percentage = (value / purchasePrice) * 100;
            percentage = Math.max(minDownPaymentPercentage, Math.min(percentage, maxDownPaymentPercentage));
            
            // Recalculate down payment based on constrained percentage
            value = Math.round(purchasePrice * (percentage / 100));
            
            $(this).val(formatCurrency(value));
            $('.percentage').text(formatPercentage(percentage));
            updateDownPaymentSlider(percentage);
            
            updateCalculator();
        }
    });

    // Handle Down Payment Percentage Dropdown changes
    $('#down-payment-percentage-dropdown').on('change', function() {
        const percentage = parseFloat($(this).val());
        const purchasePrice = parseFloat($('#purchase-price').val().replace(/[^0-9.-]+/g, '')) || initialValues.purchasePrice;
        
        // Calculate down payment based on selected percentage
        const downPayment = Math.round(purchasePrice * (percentage / 100));
        
        // Update displays
        $('#down-payment').val(formatCurrency(downPayment));
        $('.percentage').text(formatPercentage(percentage));
        updateDownPaymentSlider(percentage);
        
        updateCalculator();
    });

    // Handle Amortization Years input changes
    $('#amortization-years').on('input', function() {
        let value = $(this).val().replace(/[^0-9]/g, '');
        if (value) {
            value = parseInt(value);
            value = Math.max(minAmortization, Math.min(value, maxAmortization));
            
            $(this).val(value);
            updateAmortizationSlider(value);
            
            // Get the months value
            const months = parseInt($('#amortization-months').val()) || 0;
            
            // Update amortization display using direct DOM manipulation
            const amortizationDisplay = 
                months > 0 
                    ? `${value} years ${months} months` 
                    : `${value} years`;
            document.querySelector('.amortization-period .result-value').textContent = amortizationDisplay;
            
            updateCalculator();
        }
    });

    // Handle Amortization Months input changes
    $('#amortization-months').on('input', function() {
        let value = $(this).val().replace(/[^0-9]/g, '');
        if (value) {
            value = parseInt(value);
            value = Math.max(0, Math.min(value, 11));
            
            $(this).val(value);
            
            // Get the years value
            const years = parseInt($('#amortization-years').val()) || initialValues.amortizationYears;
            
            // Update amortization display using direct DOM manipulation
            const amortizationDisplay = 
                value > 0 
                    ? `${years} years ${value} months` 
                    : `${years} years`;
            document.querySelector('.amortization-period .result-value').textContent = amortizationDisplay;
            
            updateCalculator();
        }
    });

    // Handle Ancillary Cost input changes
    $('.cost-input-field input').on('input', function() {
        let value = $(this).val().replace(/[^0-9.-]+/g, '');
        if (value) {
            value = parseInt(value);
            $(this).val(formatCurrency(value));
            
            // Update corresponding slider if exists
            const id = $(this).attr('id');
            // Convert kebab-case to camelCase
            const costType = id.replace(/-([a-z])/g, function(match, letter) {
                return letter.toUpperCase();
            });
            
            if (costRanges[costType]) {
                const range = costRanges[costType];
                value = Math.max(range.min, Math.min(value, range.max));
                updateCostSlider(costType, value);
            }
            
            updateCalculator();
        }
    });

    // Handle checkbox changes
    $('#newly-built-home, #first-time-homebuyer, #foreign-buyer').on('change', function() {
        updateCalculator();
    });

    // Handle Interest Rate input changes
    $('#interest-rate').on('input', function() {
        let value = $(this).val().replace(/[^0-9.]+/g, '');
        if (value) {
            value = parseFloat(value);
            value = Math.max(minInterestRate, Math.min(value, maxInterestRate));
            
            $(this).val(value + '%');
            updateInterestRateSlider(value);
            
            updateCalculator();
        }
    });

    // Handle Location input changes
    $('#location').on('change', function() {
        const newLocation = $(this).val();
        changeLocation(newLocation);
    });

    // Handle Location dropdown in results box
    $('.location-dropdown').on('click', function() {
        // Create and show a dropdown menu of available locations
        if (!$('.location-menu').length) {
            const menu = $('<div class="location-menu"></div>');
            
            // Add each available location to the menu
            Object.keys(locationData).forEach(loc => {
                const item = $(`<div class="location-item">${loc}</div>`);
                item.on('click', function() {
                    changeLocation(loc);
                    $('.location-menu').remove();
                });
                menu.append(item);
            });
            
            // Add the menu to the document
            $(this).append(menu);
            
            // Close the menu when clicking outside
            $(document).on('click', function(e) {
                if (!$(e.target).closest('.location-dropdown').length) {
                    $('.location-menu').remove();
                }
            });
        } else {
            $('.location-menu').remove();
        }
    });

    // Initialize calculator
    initializeInputs();
    initializeSliders();
    
    // Initialize all cost sliders with the new method
    initializeAllCostSliders();
    
    // Delay initial calculation for smoother loading animation
    setTimeout(function() {
        updateCalculator();
    }, 500);
    
    setupFixedResults();

    // Add location handling
    function changeLocation(newLocation) {
        if (locationData[newLocation]) {
            // Update the initialValues with the new location data
            initialValues.location = newLocation;
            initialValues.province = locationData[newLocation].province;
            initialValues.city = locationData[newLocation].city;
            
            // Update the location display
            $('#location').val(newLocation);
            $('.location-value').text(locationData[newLocation].city);
            
            // Recalculate
            updateCalculator();
        }
    }

    // Update all cost slider input events properly
    $('.cost-item input').on('input', function() {
        const id = $(this).attr('id');
        let value = $(this).val().replace(/[^0-9.-]+/g, '');
        
        if (value === '' || isNaN(value)) {
            value = 0;
        } else {
            value = parseInt(value);
        }
        
        // Convert kebab-case to camelCase
        const costType = id.replace(/-([a-z])/g, function(match, letter) {
            return letter.toUpperCase();
        });
        
        // Apply range constraints if this is a slider-controlled input
        if (costRanges[costType]) {
            const range = costRanges[costType];
            value = Math.max(range.min, Math.min(value, range.max));
        }
        
        // Update displayed value
        $(this).val(formatCurrency(value));
        
        // Update slider position if applicable
        if (costRanges[costType]) {
            updateCostSlider(costType, value);
        }
        
        // Update calculator
        updateCalculator();
    });

    // Initialize cost sliders properly
    function initializeAllCostSliders() {
        // Loop through all cost types
        Object.keys(costRanges).forEach(costType => {
            // Convert camelCase to kebab-case for CSS selector
            const cssSelector = costType.replace(/([A-Z])/g, '-$1').toLowerCase();
            
            // Get the slider element
            const sliderElement = $(`.${cssSelector}-slider`);
            if (sliderElement.length === 0) return;
            
            // Clear any existing event handlers to avoid duplicates
            sliderElement.off('mousedown touchstart');
            
            // Direct click/tap handler for the entire slider area
            sliderElement.on('click', function(e) {
                if (e.target === this || $(e.target).hasClass('slider-track')) {
                    handleCostSlider(e, costType);
                }
            });
            
            // Add mousedown handler to the slider and thumb
            sliderElement.on('mousedown', function(e) {
                e.preventDefault();
                handleCostSlider(e, costType);
                
                // Add document-level event handlers
                $(document).on(`mousemove.${costType}`, function(evt) {
                    evt.preventDefault();
                    handleCostSlider(evt, costType);
                });
                
                $(document).on(`mouseup.${costType}`, function() {
                    $(document).off(`mousemove.${costType} mouseup.${costType}`);
                });
            });
            
            // Add touch support for mobile devices
            sliderElement.on('touchstart', function(e) {
                const touch = e.originalEvent.touches[0];
                e.preventDefault();
                
                // Create a new event object with the touch coordinates
                const touchEvent = {
                    pageX: touch.pageX,
                    pageY: touch.pageY
                };
                
                handleCostSlider(touchEvent, costType);
                
                // Add document-level touch handlers
                $(document).on(`touchmove.${costType}`, function(evt) {
                    evt.preventDefault();
                    const moveTouch = evt.originalEvent.touches[0];
                    
                    const moveTouchEvent = {
                        pageX: moveTouch.pageX,
                        pageY: moveTouch.pageY
                    };
                    
                    handleCostSlider(moveTouchEvent, costType);
                });
                
                $(document).on(`touchend.${costType}`, function() {
                    $(document).off(`touchmove.${costType} touchend.${costType}`);
                });
            });
            
            // Make sure the thumb can be dragged too
            sliderElement.find('.slider-thumb').on('mousedown', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Add document-level event handlers
                $(document).on(`mousemove.${costType}`, function(evt) {
                    evt.preventDefault();
                    handleCostSlider(evt, costType);
                });
                
                $(document).on(`mouseup.${costType}`, function() {
                    $(document).off(`mousemove.${costType} mouseup.${costType}`);
                });
            });
        });
    }

    // Update interest rate input to allow manual entry
    function initializeInterestRateInput() {
        const rateInput = $('#interest-rate');
        
        // Allow manual input while keeping slider functionality
        rateInput.prop('readonly', false);
        
        rateInput.on('input', function() {
            let value = $(this).val().replace(/[^\d.]/g, '');
            if (value !== '') {
                // Parse as float and limit range
                value = Math.min(Math.max(parseFloat(value), 0), 100);
                $(this).val(value + '%');
                
                // Update slider if it exists
                if ($('.interest-rate-slider').length) {
                    const sliderRange = maxInterestRate - minInterestRate;
                    const percentage = (value - minInterestRate) / sliderRange * 100;
                    $('.interest-rate-slider .slider-thumb').css('left', percentage + '%');
                    $('.interest-rate-slider .slider-track').css('width', percentage + '%');
                }
                
                // Update calculations
                updateCalculator();
            }
        });
        
        // Format on blur
        rateInput.on('blur', function() {
            let value = parseFloat($(this).val().replace(/[^\d.]/g, '')) || 0;
            $(this).val(value.toFixed(2) + '%');
        });
    }

    // Land transfer tax calculations by province/city
    function calculateLandTransferTax(price, isFirstTimeBuyer) {
        let tax = 0;
        let provincialTax = 0;
        let municipalTax = 0;
        
        switch(location) {
            case 'Toronto, ON':
                // Ontario provincial tax
                if (price <= 55000) {
                    provincialTax = price * 0.005;
                } else if (price <= 250000) {
                    provincialTax = 275 + ((price - 55000) * 0.01);
                } else if (price <= 400000) {
                    provincialTax = 2225 + ((price - 250000) * 0.015);
                } else if (price <= 2000000) {
                    provincialTax = 4475 + ((price - 400000) * 0.02);
                } else {
                    provincialTax = 36475 + ((price - 2000000) * 0.025);
                }
                
                // Toronto municipal tax (same rates as provincial)
                if (price <= 55000) {
                    municipalTax = price * 0.005;
                } else if (price <= 250000) {
                    municipalTax = 275 + ((price - 55000) * 0.01);
                } else if (price <= 400000) {
                    municipalTax = 2225 + ((price - 250000) * 0.015);
                } else if (price <= 2000000) {
                    municipalTax = 4475 + ((price - 400000) * 0.02);
                } else {
                    municipalTax = 36475 + ((price - 2000000) * 0.025);
                }
                
                tax = provincialTax + municipalTax;
                break;
                
            case 'Vancouver, BC':
                // BC Property Transfer Tax
                if (price <= 200000) {
                    provincialTax = price * 0.01;
                } else if (price <= 2000000) {
                    provincialTax = 2000 + ((price - 200000) * 0.02);
                } else if (price <= 3000000) {
                    provincialTax = 38000 + ((price - 2000000) * 0.03);
                } else {
                    provincialTax = 68000 + ((price - 3000000) * 0.05);
                }
                
                // Vancouver additional 0.5% on values over $500,000
                if (price > 500000) {
                    municipalTax = Math.min(price - 500000, 1500000) * 0.005;
                    if (price > 2000000) {
                        municipalTax += (price - 2000000) * 0.005;
                    }
                }
                
                tax = provincialTax + municipalTax;
                break;
                
            case 'Winnipeg, MB':
                // Manitoba Land Transfer Tax
                if (price <= 30000) {
                    tax = 0;
                } else if (price <= 90000) {
                    tax = (price - 30000) * 0.005;
                } else if (price <= 150000) {
                    tax = 300 + ((price - 90000) * 0.01);
                } else if (price <= 200000) {
                    tax = 900 + ((price - 150000) * 0.015);
                } else {
                    tax = 1650 + ((price - 200000) * 0.02);
                }
                break;
                
            case 'Halifax, NS':
                // Nova Scotia Deed Transfer Tax (varies by municipality)
                // Halifax charges 1.5%
                tax = price * 0.015;
                break;
                
            case 'Montréal, QC':
                // Quebec Transfer Duties (Welcome Tax)
                if (price <= 53200) {
                    tax = price * 0.005;
                } else if (price <= 266200) {
                    tax = 266 + (price - 53200) * 0.01;
                } else if (price <= 532300) {
                    tax = 2396 + (price - 266200) * 0.015;
                } else if (price <= 1000000) {
                    tax = 6394 + (price - 532300) * 0.02;
                } else if (price <= 2000000) {
                    tax = 15748 + (price - 1000000) * 0.025;
                } else {
                    tax = 40748 + (price - 2000000) * 0.03;
                }
                break;
                
            case 'Edmonton, AB':
                // Alberta has no provincial land transfer tax
                // But there are Land Title Transfer fees
                const baseRegistrationFee = 50;
                const valueBasedFee = Math.ceil(price / 5000) * 2;
                tax = baseRegistrationFee + valueBasedFee;
                break;
                
            // Add other locations as needed
            default:
                tax = 0;
        }
        
        return Math.round(tax);
    }

    // Calculate first-time home buyer rebates
    function calculateRebate(price) {
        let rebate = 0;
        
        switch(location) {
            case 'Toronto, ON':
                // Ontario FTHB Rebate - max $4,000 provincial
                let provincialRebate = 0;
                if (price <= 368000) {
                    // Full provincial rebate
                    provincialRebate = Math.min(calculateProvincialTax(price, 'ON', false, false), 4000);
                }
                
                // Toronto FTHB Rebate - max $4,475 municipal
                let torontoRebate = 0;
                if (price <= 400000) {
                    // Full Toronto rebate
                    torontoRebate = Math.min(calculateTorontoLandTransferTax(price), 4475);
                }
                
                rebate = provincialRebate + torontoRebate;
                break;
                
            case 'Vancouver, BC':
                // BC FTHB Program
                if (price <= 500000) {
                    // Full exemption
                    rebate = calculateLandTransferTax(price, false);
                } else if (price <= 525000) {
                    // Partial exemption
                    const fullTax = calculateLandTransferTax(price, false);
                    rebate = fullTax * ((525000 - price) / 25000);
                }
                break;
                
            case 'Winnipeg, MB':
                // Manitoba FTHB Program
                if (price <= 250000) {
                    rebate = Math.min(calculateLandTransferTax(price, false), 3750);
                } else if (price <= 300000) {
                    // Partial rebate for homes between $250K and $300K
                    const fullRebate = 3750;
                    rebate = fullRebate * ((300000 - price) / 50000);
                }
                break;
                
            case 'Halifax, NS':
                // Nova Scotia FTHB Rebate
                // As of 2023, first-time buyers get rebate on homes up to $300,000
                if (price <= 300000) {
                    rebate = calculateLandTransferTax(price, false);
                }
                break;
                
            case 'Montréal, QC':
                // Quebec/Montreal FTHB rebate
                if (price <= 300000) {
                    // Refund of up to $5,000
                    rebate = Math.min(calculateLandTransferTax(price, false), 5000);
                }
                break;
                
            case 'Edmonton, AB':
                // No specific rebate since tax is minimal
                rebate = 0;
                break;
                
            default:
                rebate = 0;
        }
        
        return Math.round(rebate);
    }

    // Helper function for Ontario provincial LTT
    function calculateProvincialLandTransferTax(price) {
        let tax = 0;
        
        if (price <= 55000) {
            tax = price * 0.005;
        } else if (price <= 250000) {
            tax = 275 + ((price - 55000) * 0.01);
        } else if (price <= 400000) {
            tax = 2225 + ((price - 250000) * 0.015);
        } else if (price <= 2000000) {
            tax = 4475 + ((price - 400000) * 0.02);
        } else {
            tax = 36475 + ((price - 2000000) * 0.025);
        }
        
        return tax;
    }

    // Helper function for Toronto municipal LTT
    function calculateTorontoLandTransferTax(price) {
        let tax = 0;
        
        if (price <= 55000) {
            tax = price * 0.005;
        } else if (price <= 250000) {
            tax = 275 + ((price - 55000) * 0.01);
        } else if (price <= 400000) {
            tax = 2225 + ((price - 250000) * 0.015);
        } else if (price <= 2000000) {
            tax = 4475 + ((price - 400000) * 0.02);
        } else {
            tax = 36475 + ((price - 2000000) * 0.025);
        }
        
        return tax;
    }

    // Calculate all closing costs
    function calculateClosingCosts() {
        const purchasePrice = parseCurrency($('#purchase-price').val());
        const downPayment = parseCurrency($('#down-payment').val());
        const downPaymentPercentage = (downPayment / purchasePrice) * 100;
        const isFirstTimeBuyer = $('#first-time-buyer').is(':checked');
        
        // Calculate land transfer tax
        const landTransferTax = calculateLandTransferTax(purchasePrice, isFirstTimeBuyer);
        
        // Calculate mortgage insurance
        const mortgageInsurance = calculateMortgageInsurance(purchasePrice, downPaymentPercentage);
        
        // Calculate ancillary costs
        const ancillaryCosts = calculateAncillaryCosts();
        
        // Calculate total closing costs
        const totalClosingCosts = landTransferTax + mortgageInsurance + ancillaryCosts;
        
        // Update the display
        $('#land-transfer-tax').text(formatCurrency(landTransferTax));
        $('#first-time-rebate').text(formatCurrency(isFirstTimeBuyer ? calculateRebate(purchasePrice) : 0));
        $('#total-closing-costs').text(formatCurrency(totalClosingCosts));
    }

    // Initialize the calculator
    $(document).ready(function() {
        // Set up location dropdown with all required locations
        $('#location').html(`
            <option value="Toronto, ON">Toronto, ON</option>
            <option value="Vancouver, BC">Vancouver, BC</option>
            <option value="Winnipeg, MB">Winnipeg, MB</option>
            <option value="Halifax, NS">Halifax, NS</option>
            <option value="Montréal, QC">Montréal, QC</option>
            <option value="Edmonton, AB">Edmonton, AB</option>
            <option value="Other">Other</option>
        `);
        
        // Set up interest rate manual input
        setupInterestRateInput();
        
        // Add first-time buyer checkbox if not present
        // Add newly built home checkbox if not present
        if ($('#newly-built-home').length === 0) {
            $('.calculator-form').append(`
                <div class="form-group">
                    <label for="newly-built-home">Newly Built Home</label>
                    <input type="checkbox" id="newly-built-home">
                </div>
            `);
            
            $('#newly-built-home').on('change', calculateClosingCosts);
        }
        
        // Add Real Estate Lawyer to the ancillary cost section if not present
        if ($('.cost-item:contains("Real Estate Lawyer")').length === 0) {
            $('.cost-item:contains("Brokerage Fee")').after(`
                <div class="cost-item">
                    <div class="cost-label">Real Estate Lawyer</div>
                    <div class="cost-input-field">
                        <input type="text" id="real-estate-lawyer" value="$1,500">
                    </div>
                    <div class="info-icon required">i</div>
                </div>
                <div class="cost-slider real-estate-lawyer-slider">
                    <div class="slider-track"></div>
                    <div class="slider-thumb"></div>
                </div>
            `);
            
            // Initialize the new slider
            initializeCostSlider('real-estate-lawyer', 1500, 1000, 3000);
        }
        
        // Set title insurance fixed at $350
        $('#title-insurance').val('$350');
        $('#title-insurance').prop('readonly', true);
        
        // Initialize calculations
        calculateClosingCosts();
    });
}); 