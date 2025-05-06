$(document).ready(function () {
    // Mobile menu toggle
    $('.mobile-menu-toggle').on('click', function() {
        $('.calculator-tabs').toggleClass('active');
        $(this).toggleClass('active');
    });

    // Close mobile menu when clicking outside
    $(document).on('click', function(e) {
        if (!$(e.target).closest('.calculator-tabs, .mobile-menu-toggle').length) {
            $('.calculator-tabs').removeClass('active');
            $('.mobile-menu-toggle').removeClass('active');
        }
    });

    // Initial values
    const initialValues = {
        grossIncome: 165000,
        interestRate: 4.01,
        amortizationYears: 25,
        propertyTaxMonthly: 833.33,
        propertyTaxYearly: 10000,
        condoFees: 1400,
        heatExpense: 200,
        otherMonthlyExpenses: 0,
        homeExpenses: 2433.33, // Property tax + condo fees + heat + other
        stressTestRate: 8.29, // 2% above interest rate 
        affordabilityLevel: 0.5, // 0-1 range, 0 = cautious, 1 = aggressive
        rateTerm: 5,
        rateType: 'fixed',
        rentalIncome: 0,
        hasRentalIncome: false
    };

    // Slider ranges
    const minIncome = 0;
    const maxIncome = 500000;
    const minInterestRate = 1;
    const maxInterestRate = 10;
    const minPropertyTax = 1000;
    const maxPropertyTax = 30000;
    const minCondoFees = 0;
    const maxCondoFees = 3000;
    const minHeatExpense = 0;
    const maxHeatExpense = 1000;
    const minOtherExpenses = 0;
    const maxOtherExpenses = 3000;
    const minAmortization = 15;
    const maxAmortization = 30;
    const minRentalIncome = 0;
    const maxRentalIncome = 10000;
    
    // GDS/TDS ratio limits (standard)
    const standardGDSLimit = 39.0; // 39% of gross income
    const standardTDSLimit = 44.0; // 44% of gross income
    // GDS/TDS ratio limits (cautious)
    const cautiousGDSLimit = 30.0; // 30% of gross income
    const cautiousTDSLimit = 35.0; // 35% of gross income

    // Format currency with dollar sign preserved
    function formatCurrency(amount) {
        return '$' + new Intl.NumberFormat('en-US', {
            maximumFractionDigits: 0
        }).format(amount);
    }

    // Format decimal with dollar sign preserved
    function formatDecimal(amount) {
        return '$' + new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }

    // Calculate mortgage payment
    function calculateMortgagePayment(principal, interestRate, years, months = 0) {
        const totalYears = years + (months / 12);
        const monthlyRate = interestRate / 100 / 12;
        const numberOfPayments = totalYears * 12;
        let monthlyPayment = 0;

        if (interestRate === 0) {
            monthlyPayment = principal / numberOfPayments;
        } else {
            monthlyPayment = principal * monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments) / (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
        }

        return monthlyPayment;
    }

    // Calculate maximum mortgage
    function calculateMaximumMortgage(grossIncome, interestRate, amortizationYears, amortizationMonths, homeExpenses, affordabilityLevel) {
        // Convert annual income to monthly
        let monthlyIncome = grossIncome / 12;
        
        // Add 50% of rental income to total income if rental income is active
        if ($('.toggle-switch').hasClass('active')) {
            const rentalIncome = parseFloat($('#rental-income-monthly').val().replace(/[^0-9.-]+/g, '')) || 0;
            monthlyIncome += (rentalIncome * 0.5); // Add 50% of rental income to total income
        }
        
        // Calculate stress test rate (2% higher than regular rate)
        const stressTestRate = Math.max(interestRate + 2, 5.25);
        
        // Determine GDS limit based on affordability level (0-1 scale)
        const gdsLimit = cautiousGDSLimit + (affordabilityLevel * (standardGDSLimit - cautiousGDSLimit));
        
        // Calculate maximum total monthly housing cost (mortgage + property tax + heat + 50% of condo fees)
        const maxTotalMonthlyCost = monthlyIncome * (gdsLimit / 100);
        
        // Get individual expense values
        const propertyTaxMonthly = parseFloat($('#property-tax-monthly').val().replace(/[^0-9.-]+/g, '')) || 0;
        const heatExpense = parseFloat($('#heat-expense').val().replace(/[^0-9.-]+/g, '')) || 0;
        const condoFees = parseFloat($('#condo-fees').val().replace(/[^0-9.-]+/g, '')) || 0;
        
        // Subtract property tax, heat, and 50% of condo fees from max total to get max mortgage payment
        const maxMortgagePayment = maxTotalMonthlyCost - propertyTaxMonthly - heatExpense - (condoFees * 0.5);
        
        // Calculate maximum mortgage using Canadian standard semi-annual compounding
        const semiAnnualRate = stressTestRate / 100 / 2;
        const effectiveMonthlyRate = Math.pow(1 + semiAnnualRate, 2/12) - 1;
        const totalPayments = amortizationYears * 12 + amortizationMonths;
        
        // Use the correct formula for Canadian mortgages with semi-annual compounding
        let maximumMortgage = maxMortgagePayment * 
            (1 - Math.pow(1 + effectiveMonthlyRate, -totalPayments)) / 
            effectiveMonthlyRate;
        
        return Math.max(0, Math.round(maximumMortgage));
    }

    // Calculate home expenses
    function calculateTotalHomeExpenses() {
        const propertyTaxMonthly = parseFloat($('#propertyTaxes').val().replace(/[^0-9.-]+/g, '')) || 0;
        const condoFees = parseFloat($('#condoFees').val().replace(/[^0-9.-]+/g, '')) || 0;
        const heatExpense = parseFloat($('#heatingCosts').val().replace(/[^0-9.-]+/g, '')) || 0;

        return (propertyTaxMonthly/12) + condoFees + heatExpense;

    }

    // Animation function for smooth transitions between values
    function animateValue(element, start, end, duration, isDecimal) {
        // Add highlighting class
        $(element).addClass('value-changing');

        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const easedProgress = progress * (2 - progress); // Ease out function

            // Calculate current value
            const current = start + easedProgress * (end - start);

            // Format appropriately
            if (isDecimal) {
                $(element).text(formatDecimal(current));
            } else {
                $(element).text(formatCurrency(current));
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

    // Update Income slider position
    function updateIncomeSliderPosition(income) {
        const percentage = (income - minIncome) / (maxIncome - minIncome);
        $('.income-slider .slider-track').css('width', (percentage * 100) + '%');
        $('.income-slider .slider-thumb').css('left', (percentage * 100) + '%');
    }

    // Update Interest Rate slider position
    function updateRateSliderPosition(rate) {
        const percentage = (rate - minInterestRate) / (maxInterestRate - minInterestRate);
        $('.rate-slider .slider-track').css('width', (percentage * 100) + '%');
        $('.rate-slider .slider-thumb').css('left', (percentage * 100) + '%');
    }

    // Update Property Tax slider position
    function updatePropertyTaxSliderPosition(value) {
        const percentage = Math.min(1, Math.max(0, (value - minPropertyTax) / (maxPropertyTax - minPropertyTax)));
        $('.property-tax-slider .slider-track').css('width', (percentage * 100) + '%');
        $('.property-tax-slider .slider-thumb').css('left', (percentage * 100) + '%');
    }

    // Update Heat Expense slider position
    function updateHeatSliderPosition(heat) {
        const percentage = (heat - minHeatExpense) / (maxHeatExpense - minHeatExpense);
        $('.heat-slider .slider-track').css('width', (percentage * 100) + '%');
        $('.heat-slider .slider-thumb').css('left', (percentage * 100) + '%');
    }

    // Update Condo Fees slider position
    function updateCondoFeesSliderPosition(fees) {
        const percentage = (fees - minCondoFees) / (maxCondoFees - minCondoFees);
        $('.condo-fees-slider .slider-track').css('width', (percentage * 100) + '%');
        $('.condo-fees-slider .slider-thumb').css('left', (percentage * 100) + '%');
    }

    // Update Amortization slider position
    function updateAmortizationSliderPosition(years) {
        const percentage = (years - minAmortization) / (maxAmortization - minAmortization);
        $('.amortization-slider .slider-track').css('width', (percentage * 100) + '%');
        $('.amortization-slider .slider-thumb').css('left', (percentage * 100) + '%');
    }

    // Update Rental Income slider position
    function updateRentalSliderPosition(rental) {
        const percentage = (rental - minRentalIncome) / (maxRentalIncome - minRentalIncome);
        $('.rental-slider .slider-track').css('width', (percentage * 100) + '%');
        $('.rental-slider .slider-thumb').css('left', (percentage * 100) + '%');
    }

    // Rental Income Slider Interaction
    function handleRentalSliderInteraction(e) {
        const sliderElement = $('.rental-slider');
        const sliderWidth = sliderElement.width();
        let clickPosition = e.pageX - sliderElement.offset().left;

        // Constrain within the slider bounds
        clickPosition = Math.max(0, Math.min(clickPosition, sliderWidth));

        const percentage = clickPosition / sliderWidth;

        // Update slider visually
        $('.rental-slider .slider-track').css('width', (percentage * 100) + '%');
        $('.rental-slider .slider-thumb').css('left', (percentage * 100) + '%');

        // Calculate new rental income based on slider position
        const newRental = Math.round(minRentalIncome + (maxRentalIncome - minRentalIncome) * percentage);

        // Update rental income inputs
        $('#rental-income-monthly').val(formatCurrency(newRental));
        $('#rental-income-yearly').val(formatCurrency(newRental * 12));

        // Update calculator
        updateCalculator();
    }
        document.getElementById('calculateBtn').addEventListener('click', displayResults);

    // Update calculator with current values
    function updateCalculator() {

    // Get input values
        const yourIncome = parseFloat($('#yourIncome').val().replace(/[^0-9.-]+/g, '')) || 0;
        const interestRate = parseFloat($('#interestRate').val().replace(/[^0-9.-]+/g, '')/100) || 0;
        const amortization = parseInt($('#amortization').val()) || 25;
        const homeExpenses = calculateTotalHomeExpenses();
        const stressTestRate = interestRate + 2; // 2% higher for stress test
     
      
        const coApplicantIncome = parseFloat(document.getElementById('coApplicantIncome').value.replace(/[^0-9.-]+/g, '')) || 0;
        const creditScore = parseFloat(document.getElementById('creditScore').value.replace(/[^0-9.-]+/g, '')) || 0;
        const downPayment = parseFloat(document.getElementById('downPayment').value.replace(/[^0-9.-]+/g, '')) || 0;
        const propertyTaxes = parseFloat(document.getElementById('propertyTaxes').value.replace(/[^0-9.-]+/g, '')) || 0;
        const heatingCosts = parseFloat(document.getElementById('heatingCosts').value.replace(/[^0-9.-]+/g, '')) || 0;
        const condoFees = parseFloat(document.getElementById('condoFees').value.replace(/[^0-9.-]+/g, '')) || 0;
        const carLoans = parseFloat(document.getElementById('carLoans').value.replace(/[^0-9.-]+/g, '')) || 0;
        const studentLoans = parseFloat(document.getElementById('studentLoans').value.replace(/[^0-9.-]+/g, '')) || 0;
        const creditCardDebt = parseFloat(document.getElementById('creditCardDebt').value.replace(/[^0-9.-]+/g, '')) || 0;
        const personalLoans = parseFloat(document.getElementById('personalLoans').value.replace(/[^0-9.-]+/g, '')) || 0;

        const inputArray = [yourIncome,
                            interestRate,
                            amortization,
                            homeExpenses,
                            stressTestRate,
                            coApplicantIncome,
                            creditScore,
                            downPayment,
                            propertyTaxes,
                            heatingCosts,
                            condoFees,
                            carLoans,
                            studentLoans,
                            creditCardDebt,
                            personalLoans
                        ];
        console.log('inputArray', inputArray);
        // Constants
        const STRESS_TEST_BENCHMARK_RATE = 0.0525;
        const amortizationMonths = amortization * 12;
    
    // CMHC Premium Rates
        const cmhcPremiumRates = {
            '5-9.99': 0.04,
            '10-14.99': 0.031,
            '15-19.99': 0.028,
            '20+': 0
        };

        // Calculate monthly income
        const householdMonthlyIncome = (yourIncome + coApplicantIncome) / 12;

        // Calculate stress tested rate
        const annualStressTestedRate = Math.max(interestRate + 0.02, STRESS_TEST_BENCHMARK_RATE);
        const monthlyInterestRate = annualStressTestedRate / 12;

        // Calculate maximum purchase price based on down payment
        let maxPurchaseBasedOnDownPayment;
        if (downPayment > 199999) {
            maxPurchaseBasedOnDownPayment = downPayment / 0.2;
        } else if (downPayment > 75000) {
            maxPurchaseBasedOnDownPayment = 999999;
        } else if (downPayment > 25000) {
            maxPurchaseBasedOnDownPayment = (downPayment / 0.1) + 250000;
        } else {
            maxPurchaseBasedOnDownPayment = downPayment / 0.05;
        }

        // TDS Calculation
        const tdsRatio = creditScore < 650 ? 0.42 : 0.44;
        const totalMonthlyLiabilities = carLoans + studentLoans + creditCardDebt + personalLoans;

        const cashLeft = (yourIncome/12) - homeExpenses - totalMonthlyLiabilities;
        const monthlyPropertyTaxesAndFees = (propertyTaxes / 12) + (0.5 * condoFees);
        const monthlyHeatingCost = heatingCosts;
        
        const maxAllowableTDSPayment = (tdsRatio * householdMonthlyIncome) - 
                                     (totalMonthlyLiabilities + monthlyPropertyTaxesAndFees + monthlyHeatingCost);
        
        // Calculate maximum mortgage amount based on TDS
        const maxMortgageAmountTDS = (maxAllowableTDSPayment * (1 - Math.pow(1 + monthlyInterestRate, -amortizationMonths))) / monthlyInterestRate;
        const maxPurchasePriceTDS = maxMortgageAmountTDS + downPayment;


        // GDS Calculation
        const gdsRatio = creditScore < 650 ? 0.36 : 0.39;
        const maxAllowableGDSPayment = (gdsRatio * householdMonthlyIncome) - 
                                     (monthlyPropertyTaxesAndFees + monthlyHeatingCost);
        
        // Calculate maximum mortgage amount based on GDS
        const maxMortgageAmountGDS = (maxAllowableGDSPayment * (1 - Math.pow(1 + monthlyInterestRate, -amortizationMonths))) / monthlyInterestRate;
        const maxPurchasePriceGDS = maxMortgageAmountGDS + downPayment;

        // CMHC Premium Calculations
        const downPaymentPercentageTDS = downPayment / maxPurchasePriceTDS;
        const downPaymentPercentageGDS = downPayment / maxPurchasePriceGDS;
        
        const getCMHCPremium = (downPaymentPercentage) => {
            if (downPaymentPercentage >= 0.20) return cmhcPremiumRates['20+'];
            if (downPaymentPercentage >= 0.15) return cmhcPremiumRates['15-19.99'];
            if (downPaymentPercentage >= 0.10) return cmhcPremiumRates['10-14.99'];
            return cmhcPremiumRates['5-9.99'];
        };
        
        const cmhcPremiumRateTDS = getCMHCPremium(downPaymentPercentageTDS);
        const cmhcPremiumRateGDS = getCMHCPremium(downPaymentPercentageGDS);
        
        const cmhcPremiumAmountTDS = cmhcPremiumRateTDS * maxMortgageAmountTDS;
        const cmhcPremiumAmountGDS = cmhcPremiumRateGDS * maxMortgageAmountGDS;
        
        const mortgageWithCMHCTDS = maxMortgageAmountTDS + cmhcPremiumAmountTDS;
        const mortgageWithCMHCGDS = maxMortgageAmountGDS + cmhcPremiumAmountGDS;

        // Determine affordability limiters
        const tdsAffordabilityLimiter = maxPurchaseBasedOnDownPayment < maxMortgageAmountTDS ? "Down Payment" : "Income";
        const gdsAffordabilityLimiter = maxPurchaseBasedOnDownPayment < maxMortgageAmountGDS ? "Down Payment" : "Income";

        // Estimated Home Affordability
        const estimatedAffordabilityTDS = tdsAffordabilityLimiter === "Down Payment" ? 
            maxPurchaseBasedOnDownPayment : 
            ((maxMortgageAmountTDS - cmhcPremiumAmountTDS) + downPayment);
            
        const estimatedAffordabilityGDS = gdsAffordabilityLimiter === "Down Payment" ? 
            maxPurchaseBasedOnDownPayment : 
            ((maxMortgageAmountGDS - cmhcPremiumAmountGDS) + downPayment);

        // TDS and GDS Home Affordability
        const tdsHomeAffordability = Math.min(estimatedAffordabilityTDS, maxPurchaseBasedOnDownPayment);
        const gdsHomeAffordability = Math.min(estimatedAffordabilityGDS, maxPurchaseBasedOnDownPayment);

        // Monthly mortgage payment using GDS max mortgage
        // Use actual interest rate for monthly payment

// Then calculate monthly mortgage payment correctly
const monthlyMortgagePayment = ((interestRate/12) * (maxMortgageAmountGDS - cmhcPremiumAmountGDS)) /
                               (1 - Math.pow(1 + (interestRate/12), -amortizationMonths));

        // Final home affordability
        const finalHomeAffordability = Math.min(tdsHomeAffordability, gdsHomeAffordability);
        document.getElementById('resultValue').textContent = '$' + Math.round(finalHomeAffordability).toLocaleString();
        document.getElementById('gdsValue').textContent = gdsRatio*100+'% / '+tdsRatio*100+'%';
        document.getElementById('tdsValue').textContent = tdsRatio*100+'%';
        document.getElementById('stressValue').textContent = annualStressTestedRate*100+'%';
        document.getElementById('monthtlyMortgageValue').textContent = '$'+Math.round(monthlyMortgagePayment);
        document.getElementById('cashLeft').textContent = '$'+Math.round(cashLeft).toLocaleString();
        document.getElementById('homeExpenses').textContent = '$'+Math.round(homeExpenses).toLocaleString();


        // Return all results
        return {
            // Basic calculations
            householdMonthlyIncome,
            annualStressTestedRate,
            maxPurchaseBasedOnDownPayment,
            homeExpenses,
            monthlyMortgagePayment: Math.round(monthlyMortgagePayment),
            cashLeft,
            // TDS results
            tdsRatio,
            maxAllowableTDSPayment,
            maxMortgageAmountTDS,
            maxPurchasePriceTDS,
            mortgageWithoutCMHCTDS: maxMortgageAmountTDS - cmhcPremiumAmountTDS,
            estimatedAffordabilityTDS,
            tdsHomeAffordability,
            tdsAffordabilityLimiter,
            
            // GDS results
            gdsRatio,
            maxAllowableGDSPayment,
            maxMortgageAmountGDS,
            maxPurchasePriceGDS,
            mortgageWithoutCMHCGDS: maxMortgageAmountGDS - cmhcPremiumAmountGDS,
            estimatedAffordabilityGDS,
            gdsHomeAffordability,
            gdsAffordabilityLimiter,
            
            // CMHC results
            downPaymentPercentageTDS,
            downPaymentPercentageGDS,
            cmhcPremiumRateTDS,
            cmhcPremiumRateGDS,
            cmhcPremiumAmountTDS,
            cmhcPremiumAmountGDS,
            mortgageWithCMHCTDS,
            mortgageWithCMHCGDS,
      
            // Final result
            finalHomeAffordability
        };

    }
function displayResults() {
    const results = updateCalculator();
    console.log('results', results);
   
     document.getElementById('resultValue').textContent = '$' + Math.round(results.finalHomeAffordability).toLocaleString();
        document.getElementById('gdsValue').textContent = results.gdsRatio*100+'% / '+results.tdsRatio*100+'%';
        document.getElementById('tdsValue').textContent = results.tdsRatio*100+'%';
        document.getElementById('stressValue').textContent = results.annualStressTestedRate*100+'%';
        document.getElementById('monthtlyMortgageValue').textContent = '$'+Math.round(results.monthlyMortgagePayment);
        document.getElementById('cashLeft').textContent = '$'+Math.round(results.cashLeft).toLocaleString();
        document.getElementById('homeExpenses').textContent = '$'+Math.round(results.homeExpenses).toLocaleString();

}


window.addEventListener('load', displayResults);
    // Update the colored bar in the results section
    function updateColoredBar(mortgage, debt, expenses, cash) {
        const total = mortgage + debt + expenses + cash;
        
        $('.bar-section.mortgage').css('flex', mortgage);
        $('.bar-section.debt').css('flex', debt);
        $('.bar-section.expenses').css('flex', expenses);
        $('.bar-section.cash').css('flex', cash);
    }

    // Initialize all inputs and sliders
    function initializeInputs() {
        // Set initial input values
        $('#yourIncome').val(formatCurrency(initialValues.grossIncome));
        $('#coApplicantIncome').val('$'+0);
        $('#property-tax-monthly').val(formatCurrency(initialValues.propertyTaxMonthly));
        $('#property-tax-yearly').val(formatCurrency(initialValues.propertyTaxYearly));
        $('#condo-fees').val(formatCurrency(initialValues.condoFees));
        $('#heat-expense').val(formatCurrency(initialValues.heatExpense));
        $('#amortization-years').val(initialValues.amortizationYears);
    }

    // Initialize all slider positions
    function initializeSliders() {
        // Set initial slider positions based on starting values
        updateIncomeSliderPosition(initialValues.grossIncome);
        updateRateSliderPosition(0);
        updatePropertyTaxSliderPosition(initialValues.propertyTaxYearly);
        updateCondoFeesSliderPosition(initialValues.condoFees);
        updateHeatSliderPosition(initialValues.heatExpense);
        updateAmortizationSliderPosition(initialValues.amortizationYears);
        
        // Set rate button active state
        $('.rate-type-buttons button').removeClass('active');
        $('.rate-type-buttons button.' + initialValues.rateType).addClass('active');
        
        // Initialize colored bar
        updateColoredBar(
            Math.round(4048), 
            0, // No debt payments
            Math.round(initialValues.homeExpenses), 
            Math.round(10000)
        );
    }

    // Income Slider Interaction
    function handleIncomeSliderInteraction(e) {
        const sliderElement = $('.income-slider');
        const sliderWidth = sliderElement.width();
        let clickPosition = e.pageX - sliderElement.offset().left;

        // Constrain within the slider bounds
        clickPosition = Math.max(0, Math.min(clickPosition, sliderWidth));

        const percentage = clickPosition / sliderWidth;

        // Update slider visually
        $('.income-slider .slider-track').css('width', (percentage * 100) + '%');
        $('.income-slider .slider-thumb').css('left', (percentage * 100) + '%');

        // Calculate new income based on slider position
        const newIncome = Math.round((minIncome + (maxIncome - minIncome) * percentage) / 1000) * 1000;

        // Update income input
        $('#yourIncome').val(formatCurrency(newIncome));

        // Update calculator
        updateCalculator();
    }

    // Interest Rate Slider Interaction
    function handleRateSliderInteraction(e) {
        const sliderElement = $('.rate-slider');
       const sliderWidth = sliderElement.width();
        let clickPosition = e.pageX - sliderElement.offset().left;

        // Constrain within the slider bounds
        clickPosition = Math.max(0, Math.min(clickPosition, sliderWidth));

        const percentage = clickPosition / sliderWidth;

        // Update slider visually
        $('.rate-slider .slider-track').css('width', (percentage * 100) + '%');
        $('.rate-slider .slider-thumb').css('left', (percentage * 100) + '%');

        // Calculate new income based on slider position
        const newIncome = Math.round((minIncome + (maxIncome - minIncome) * percentage) / 1000) * 1000;

        // Update income input
        $('#coApplicantIncome').val(formatCurrency(newIncome));

        // Update calculator
        updateCalculator();
    }

    // Property Tax Slider Interaction
    function handlePropertyTaxSliderInteraction(e) {
        const sliderElement = $('.property-tax-slider');
        const sliderWidth = sliderElement.width();
        let clickPosition = e.pageX - sliderElement.offset().left;

        // Constrain within the slider bounds
        clickPosition = Math.max(0, Math.min(clickPosition, sliderWidth));

        const percentage = clickPosition / sliderWidth;

        // Update slider visually
        $('.property-tax-slider .slider-track').css('width', (percentage * 100) + '%');
        $('.property-tax-slider .slider-thumb').css('left', (percentage * 100) + '%');

        // Calculate new tax based on slider position
        const newYearlyTax = Math.round(minPropertyTax + (maxPropertyTax - minPropertyTax) * percentage);
        const newMonthlyTax = (newYearlyTax / 12).toFixed(2);

        // Update tax inputs
        $('#property-tax-yearly').val(formatCurrency(newYearlyTax));
        $('#property-tax-monthly').val(formatCurrency(newMonthlyTax));

        // Update calculator
        updateCalculator();
    }

    // Condo Fees Slider Interaction
    function handleCondoFeesSliderInteraction(e) {
        const sliderElement = $('.condo-fees-slider');
        const sliderWidth = sliderElement.width();
        let clickPosition = e.pageX - sliderElement.offset().left;

        // Constrain within the slider bounds
        clickPosition = Math.max(0, Math.min(clickPosition, sliderWidth));

        const percentage = clickPosition / sliderWidth;

        // Update slider visually
        $('.condo-fees-slider .slider-track').css('width', (percentage * 100) + '%');
        $('.condo-fees-slider .slider-thumb').css('left', (percentage * 100) + '%');

        // Calculate new condo fees based on slider position
        const newCondoFees = Math.round(minCondoFees + (maxCondoFees - minCondoFees) * percentage);

        // Update condo fees input
        $('#condo-fees').val(formatCurrency(newCondoFees));

        // Update calculator
        updateCalculator();
    }

    // Heat Expense Slider Interaction
    function handleHeatSliderInteraction(e) {
        const sliderElement = $('.heat-slider');
        const sliderWidth = sliderElement.width();
        let clickPosition = e.pageX - sliderElement.offset().left;

        // Constrain within the slider bounds
        clickPosition = Math.max(0, Math.min(clickPosition, sliderWidth));

        const percentage = clickPosition / sliderWidth;

        // Update slider visually
        $('.heat-slider .slider-track').css('width', (percentage * 100) + '%');
        $('.heat-slider .slider-thumb').css('left', (percentage * 100) + '%');

        // Calculate new heat expense based on slider position
        const newHeat = Math.round(minHeatExpense + (maxHeatExpense - minHeatExpense) * percentage);

        // Update heat expense input
        $('#heat-expense').val(formatCurrency(newHeat));

        // Update calculator
        updateCalculator();
    }

    // Amortization Dropdown Interaction
    function handleAmortizationDropdownChange() {
        const years = parseInt($('#amortization-years').val());
        updateAmortizationSliderPosition(years);
        updateCalculator();
    }

    // Bind event listeners for amortization dropdown
    $('#amortization-years').on('change', handleAmortizationDropdownChange);

    // Bind event listeners for sliders
    $('.income-slider').on('mousedown', function(e) {
        handleIncomeSliderInteraction(e);
        $(document).on('mousemove.incomeslider', handleIncomeSliderInteraction);
        $(document).on('mouseup.incomeslider', function() {
            $(document).off('mousemove.incomeslider mouseup.incomeslider');
        });
    });

    $('.rate-slider').on('mousedown', function(e) {
        handleRateSliderInteraction(e);
        $(document).on('mousemove.rateslider', handleRateSliderInteraction);
        $(document).on('mouseup.rateslider', function() {
            $(document).off('mousemove.rateslider mouseup.rateslider');
        });
    });

    $('.property-tax-slider').on('mousedown', function(e) {
        handlePropertyTaxSliderInteraction(e);
        $(document).on('mousemove.taxslider', handlePropertyTaxSliderInteraction);
        $(document).on('mouseup.taxslider', function() {
            $(document).off('mousemove.taxslider mouseup.taxslider');
        });
    });

    $('.condo-fees-slider').on('mousedown', function(e) {
        handleCondoFeesSliderInteraction(e);
        $(document).on('mousemove.condoslider', handleCondoFeesSliderInteraction);
        $(document).on('mouseup.condoslider', function() {
            $(document).off('mousemove.condoslider mouseup.condoslider');
        });
    });

    $('.heat-slider').on('mousedown', function(e) {
        handleHeatSliderInteraction(e);
        $(document).on('mousemove.heatslider', handleHeatSliderInteraction);
        $(document).on('mouseup.heatslider', function() {
            $(document).off('mousemove.heatslider mouseup.heatslider');
        });
    });

    $('.amortization-slider').on('mousedown', function(e) {
        handleAmortizationSliderInteraction(e);
        $(document).on('mousemove.amortslider', handleAmortizationSliderInteraction);
        $(document).on('mouseup.amortslider', function() {
            $(document).off('mousemove.amortslider mouseup.amortslider');
        });
    });

    // Handle input changes
    $('#downPayment, #heatingCosts, #propertyTaxes, #condoFees, #carLoans, #studentLoans, #creditCardDebt, #personalLoans').on('input', function() {
        let value = $(this).val().replace(/[^0-9]/g, '');
         updateIncomeSliderPosition(value);
            $(this).val(formatCurrency(value));
            updateCalculator();
       
    });

    $('#interestRate').on('input', function() {
        let value = $(this).val().replace(/[^0-9.-]+/g, '');
        updateRateSliderPosition(value);
            // $(this).val(value.toFixed(2) + '%');
            updateCalculator();
    });

    $('#property-tax-yearly').on('input', function() {
        let value = $(this).val().replace(/[^0-9.-]+/g, '');
        if (value) {
            value = parseFloat(value);
            value = Math.max(minPropertyTax, Math.min(value, maxPropertyTax));
            const monthlyValue = (value / 12).toFixed(2);
            $('#property-tax-monthly').val(formatCurrency(monthlyValue));
            updatePropertyTaxSliderPosition(value);
            $(this).val(formatCurrency(value));
            updateCalculator();
        }
    });

    $('#property-tax-monthly').on('input', function() {
        let value = $(this).val().replace(/[^0-9.-]+/g, '');
        if (value) {
            value = parseFloat(value);
            const yearlyValue = Math.round(value * 12);
            updatePropertyTaxSliderPosition(yearlyValue);
            $(this).val(formatCurrency(value));
            $('#property-tax-yearly').val(formatCurrency(yearlyValue));
            updateCalculator();
        }
    });

    $('#condo-fees').on('input', function() {
        let value = $(this).val().replace(/[^0-9.-]+/g, '');
        if (value) {
            value = parseFloat(value);
            value = Math.max(minCondoFees, Math.min(value, maxCondoFees));
            updateCondoFeesSliderPosition(value);
            $(this).val(formatCurrency(value));
            updateCalculator();
        }
    });

    $('#heat-expense').on('input', function() {
        let value = $(this).val().replace(/[^0-9.-]+/g, '');
        if (value) {
            value = parseFloat(value);
            value = Math.max(minHeatExpense, Math.min(value, maxHeatExpense));
            updateHeatSliderPosition(value);
            $(this).val(formatCurrency(value));
            updateCalculator();
        }
    });

    // Handle rate button toggle
    $('.rate-btn').on('click', function() {
        $('.rate-btn').removeClass('active');
        $(this).addClass('active');
        updateCalculator();
    });

    // Handle rental income input changes
    $('#rental-income-monthly').on('input', function() {
        let value = $(this).val().replace(/[^0-9.-]+/g, '');
        if (value) {
            value = parseFloat(value);
            value = Math.max(minRentalIncome, Math.min(value, maxRentalIncome));
            $(this).val(formatCurrency(value));
            $('#rental-income-yearly').val(formatCurrency(value * 12));
            updateCalculator();
        }
    });

    $('#rental-income-yearly').on('input', function() {
        let value = $(this).val().replace(/[^0-9.-]+/g, '');
        if (value) {
            value = parseFloat(value);
            const monthlyValue = value / 12;
            $(this).val(formatCurrency(value));
            $('#rental-income-monthly').val(formatCurrency(monthlyValue));
            updateCalculator();
        }
    });

    // Toggle switch functionality
    $('.toggle-switch').on('click', function() {
        $(this).toggleClass('active');
        const isActive = $(this).hasClass('active');
        $('.rental-input-wrapper').slideToggle(200);
        
        if (!isActive) {
            $('#rental-income-monthly').val(formatCurrency(0));
            $('#rental-income-yearly').val(formatCurrency(0));
            updateRentalSliderPosition(0);
        }
        
        updateCalculator();
    });

    // Bind event listener for rental slider
    $('.rental-slider').on('mousedown', function(e) {
        handleRentalSliderInteraction(e);
        $(document).on('mousemove.rentalslider', handleRentalSliderInteraction);
        $(document).on('mouseup.rentalslider', function() {
            $(document).off('mousemove.rentalslider mouseup.rentalslider');
        });
    });

    // Initialize calculator
    initializeInputs();
    initializeSliders();
    updateCalculator();
}); 

// Parse currency input
function parseCurrency(value) {
    if (typeof value === 'string') {
        return parseFloat(value.replace(/[$,]/g, ''));
    }
    return value;
} 