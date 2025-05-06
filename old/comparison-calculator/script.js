$(document).ready(function () {
    // Initial values
    const initialValues = {
        homePrice: 500000,
        scenarios: [
            {
                id: 1,
                name: "Scenario 1",
                isActive: true,
                isStarred: true,
                isFirstTimeBuyer: true,
                isNewlyBuiltHome: false,
                downPaymentPercentage: 10,
                downPaymentAmount: 50000,
                mortgageInsurance: 13950,
                mortgageAmount: 463950,
                rate: 5.25,
                termType: "fixed",
                termYears: 5,
                amortizationYears: 25,
                amortizationMonths: 0,
                paymentFrequency: "monthly",
                paymentAmount: 2764.76,
                termInterest: 253961.76,
                termPrincipal: 84008.43,
                totalTermPayments: 337970.19,
                balanceEndOfTerm: 773159.57
            },
            {
                id: 2,
                name: "Scenario 2",
                isActive: false,
                isStarred: false,
                isFirstTimeBuyer: false,
                isNewlyBuiltHome: false,
                downPaymentPercentage: 10,
                downPaymentAmount: 50000,
                mortgageInsurance: 13950,
                mortgageAmount: 463950,
                rate: 5.25,
                termType: "fixed",
                termYears: 5,
                amortizationYears: 25,
                amortizationMonths: 0,
                paymentFrequency: "monthly",
                paymentAmount: 2764.76,
                termInterest: 253961.76,
                termPrincipal: 84008.43,
                totalTermPayments: 337970.19,
                balanceEndOfTerm: 773159.57
            },
            {
                id: 3,
                name: "Scenario 3",
                isActive: false,
                isStarred: false,
                isFirstTimeBuyer: false,
                isNewlyBuiltHome: false,
                downPaymentPercentage: 10,
                downPaymentAmount: 50000,
                mortgageInsurance: 13950,
                mortgageAmount: 463950,
                rate: 5.25,
                termType: "fixed",
                termYears: 5,
                amortizationYears: 25,
                amortizationMonths: 0,
                paymentFrequency: "monthly",
                paymentAmount: 2764.76,
                termInterest: 253961.76,
                termPrincipal: 84008.43,
                totalTermPayments: 337970.19,
                balanceEndOfTerm: 773159.57
            }
        ],
        homeExpenses: {
            propertyTax: 0,
            condoFees: 0,
            heat: 0
        }
    };

    // Format currency
    function formatCurrency(amount) {
        return '$' + new Intl.NumberFormat('en-US').format(amount);
    }

    // Format percentage
    function formatPercentage(percentage) {
        return percentage + '%';
    }

    // Calculate mortgage insurance
    function calculateMortgageInsurance(homePrice, downPaymentPercentage) {
        if (downPaymentPercentage >= 20) {
            return 0;
        }

        const loanAmount = homePrice * (1 - downPaymentPercentage / 100);
        let rate = 0;

        if (downPaymentPercentage >= 5 && downPaymentPercentage < 10) {
            rate = 0.04;
        } else if (downPaymentPercentage >= 10 && downPaymentPercentage < 15) {
            rate = 0.031;
        } else if (downPaymentPercentage >= 15 && downPaymentPercentage < 20) {
            rate = 0.028;
        }

        return Math.round(loanAmount * rate);
    }

    // Calculate mortgage amount
    function calculateMortgageAmount(homePrice, downPayment, mortgageInsurance) {
        return homePrice - downPayment + mortgageInsurance;
    }

    // Calculate mortgage payment
    function calculateMortgagePayment(mortgageAmount, interestRate, amortizationYears, frequency) {
        // Convert annual interest rate to semi-annual (Canadian standard)
        const semiAnnualRate = interestRate / 100 / 2;
        
        // Calculate effective monthly rate from semi-annual rate
        const effectiveMonthlyRate = Math.pow(1 + semiAnnualRate, 2/12) - 1;
        
        // Calculate total number of payments
        const totalPayments = amortizationYears * 12;
        
        // Calculate monthly payment using the Canadian formula with semi-annual compounding: 
        // P = L * (r * (1 + r)^n) / ((1 + r)^n - 1)
        // where r is the effective monthly rate derived from semi-annual compounding
        const monthlyPayment = mortgageAmount * 
            (effectiveMonthlyRate * Math.pow(1 + effectiveMonthlyRate, totalPayments)) / 
            (Math.pow(1 + effectiveMonthlyRate, totalPayments) - 1);
        
        // Adjust payment based on frequency
        switch (frequency) {
            case 'biweekly':
                return Math.round((monthlyPayment * 12) / 26 * 100) / 100;
            case 'accelerated':
                return Math.round((monthlyPayment * 12) / 24 * 100) / 100;
            default: // monthly
                return Math.round(monthlyPayment * 100) / 100;
        }
    }

    // Update home price
    function updateHomePrice() {
        const homePrice = parseFloat($('#home-price').val().replace(/[^0-9.-]+/g, '')) || initialValues.homePrice;
        
        // Update all scenarios
        initialValues.scenarios.forEach(scenario => {
            const downPaymentAmount = Math.round(homePrice * (scenario.downPaymentPercentage / 100));
            const mortgageInsurance = calculateMortgageInsurance(homePrice, scenario.downPaymentPercentage);
            const mortgageAmount = calculateMortgageAmount(homePrice, downPaymentAmount, mortgageInsurance);
            
            // Update values in initialValues
            scenario.downPaymentAmount = downPaymentAmount;
            scenario.mortgageInsurance = mortgageInsurance;
            scenario.mortgageAmount = mortgageAmount;
            
            // Update DOM
            $(`#down-payment-${scenario.id}`).val(formatCurrency(downPaymentAmount));
            $(`.mortgage-box[data-scenario="${scenario.id}"] .insurance-label`).text(`+ ${formatCurrency(mortgageInsurance)} Mortgage Insurance`);
            $(`.mortgage-box[data-scenario="${scenario.id}"] .amount`).text(formatCurrency(mortgageAmount));
            
            // Recalculate all values
            recalculateScenarioTermValues(scenario);
        });
    }

    // Update scenario down payment
    function updateScenarioDownPayment(scenarioId) {
        const scenario = initialValues.scenarios.find(s => s.id === scenarioId);
        const homePrice = parseFloat($('#home-price').val().replace(/[^0-9.-]+/g, '')) || initialValues.homePrice;
        
        // Get new down payment amount
        const downPaymentAmount = parseFloat($(`#down-payment-${scenarioId}`).val().replace(/[^0-9.-]+/g, '')) || scenario.downPaymentAmount;
        
        // Calculate new down payment percentage
        const downPaymentPercentage = Math.round((downPaymentAmount / homePrice) * 100 * 100) / 100;
        
        // Update the dropdown to match the percentage
        $(`#down-payment-percentage-${scenarioId}`).val(Math.round(downPaymentPercentage).toString());
        
        // Calculate mortgage insurance and mortgage amount
        const mortgageInsurance = calculateMortgageInsurance(homePrice, downPaymentPercentage);
        const mortgageAmount = calculateMortgageAmount(homePrice, downPaymentAmount, mortgageInsurance);
        
        // Update values in initialValues
        scenario.downPaymentAmount = downPaymentAmount;
        scenario.downPaymentPercentage = downPaymentPercentage;
        scenario.mortgageInsurance = mortgageInsurance;
        scenario.mortgageAmount = mortgageAmount;
        scenario.paymentAmount = calculateMortgagePayment(
            mortgageAmount,
            scenario.rate,
            scenario.amortizationYears,
            scenario.paymentFrequency
        );
        
        // Update DOM
        $(`.mortgage-box[data-scenario="${scenarioId}"] .insurance-label`).text(`+ ${formatCurrency(mortgageInsurance)} Mortgage Insurance`);
        $(`.mortgage-box[data-scenario="${scenarioId}"] .amount`).text(formatCurrency(mortgageAmount));
        $(`.payment-box[data-scenario="${scenarioId}"] .payment-amount span`).text(formatCurrency(scenario.paymentAmount));
    }

    // Update scenario down payment percentage
    function updateScenarioDownPaymentPercentage(scenarioId) {
        const scenario = initialValues.scenarios.find(s => s.id === scenarioId);
        const homePrice = parseFloat($('#home-price').val().replace(/[^0-9.-]+/g, '')) || initialValues.homePrice;
        
        // Get new down payment percentage
        const downPaymentPercentage = parseFloat($(`#down-payment-percentage-${scenarioId}`).val()) || scenario.downPaymentPercentage;
        console.log("Updating down payment percentage to: " + downPaymentPercentage + "% for scenario: " + scenarioId);
        
        // Calculate new down payment amount
        const downPaymentAmount = Math.round(homePrice * (downPaymentPercentage / 100));
        
        // Calculate mortgage insurance and mortgage amount
        const mortgageInsurance = calculateMortgageInsurance(homePrice, downPaymentPercentage);
        const mortgageAmount = calculateMortgageAmount(homePrice, downPaymentAmount, mortgageInsurance);
        
        // Update values in initialValues
        scenario.downPaymentAmount = downPaymentAmount;
        scenario.downPaymentPercentage = downPaymentPercentage;
        scenario.mortgageInsurance = mortgageInsurance;
        scenario.mortgageAmount = mortgageAmount;
        
        // Update DOM
        $(`#down-payment-${scenarioId}`).val(formatCurrency(downPaymentAmount));
        $(`.mortgage-box[data-scenario="${scenarioId}"] .insurance-label`).text(`+ ${formatCurrency(mortgageInsurance)} Mortgage Insurance`);
        $(`.mortgage-box[data-scenario="${scenarioId}"] .amount`).text(formatCurrency(mortgageAmount));
        
        // Recalculate payment and update it
        scenario.paymentAmount = calculateMortgagePayment(
            mortgageAmount,
            scenario.rate,
            scenario.amortizationYears + (scenario.amortizationMonths / 12),
            scenario.paymentFrequency
        );
        $(`.payment-box[data-scenario="${scenarioId}"] .payment-amount span`).text(formatCurrency(scenario.paymentAmount));
        
        // Update comparison results
        updateComparisonResults();
    }

    // Apply down payment to all scenarios
    function applyDownPaymentToAll(sourceScenarioId) {
        const sourceScenario = initialValues.scenarios.find(s => s.id === sourceScenarioId);
        const homePrice = parseFloat($('#home-price').val().replace(/[^0-9.-]+/g, '')) || initialValues.homePrice;
        
        // Update all other scenarios
        initialValues.scenarios.forEach(scenario => {
            if (scenario.id !== sourceScenarioId) {
                // Update values in initialValues
                scenario.downPaymentPercentage = sourceScenario.downPaymentPercentage;
                scenario.downPaymentAmount = sourceScenario.downPaymentAmount;
                scenario.mortgageInsurance = sourceScenario.mortgageInsurance;
                scenario.mortgageAmount = sourceScenario.mortgageAmount;
                scenario.paymentAmount = calculateMortgagePayment(
                    scenario.mortgageAmount,
                    scenario.rate,
                    scenario.amortizationYears,
                    scenario.paymentFrequency
                );
                
                // Update DOM
                $(`#down-payment-percentage-${scenario.id}`).val(Math.round(scenario.downPaymentPercentage).toString());
                $(`#down-payment-${scenario.id}`).val(formatCurrency(scenario.downPaymentAmount));
                $(`.mortgage-box[data-scenario="${scenario.id}"] .insurance-label`).text(`+ ${formatCurrency(scenario.mortgageInsurance)} Mortgage Insurance`);
                $(`.mortgage-box[data-scenario="${scenario.id}"] .amount`).text(formatCurrency(scenario.mortgageAmount));
                $(`.payment-box[data-scenario="${scenario.id}"] .payment-amount span`).text(formatCurrency(scenario.paymentAmount));
            }
        });
    }

    // Update amortization for a scenario
    function updateScenarioAmortization(scenarioId, years, months) {
        const scenario = initialValues.scenarios.find(s => s.id === scenarioId);
        
        // Update values in initialValues
        scenario.amortizationYears = years;
        scenario.amortizationMonths = months;
        
        // Recalculate payment
        scenario.paymentAmount = calculateMortgagePayment(
            scenario.mortgageAmount,
            scenario.rate,
            years + (months / 12),
            scenario.paymentFrequency
        );
        
        // Update DOM
        $(`.payment-box[data-scenario="${scenarioId}"] .payment-amount span`).text(formatCurrency(scenario.paymentAmount));
    }

    // Apply amortization to all scenarios
    function applyAmortizationToAll(sourceScenarioId) {
        const sourceScenario = initialValues.scenarios.find(s => s.id === sourceScenarioId);
        
        // Update all other scenarios
        initialValues.scenarios.forEach(scenario => {
            if (scenario.id !== sourceScenarioId) {
                // Update values in initialValues
                scenario.amortizationYears = sourceScenario.amortizationYears;
                scenario.amortizationMonths = sourceScenario.amortizationMonths;
                
                // Recalculate payment
                scenario.paymentAmount = calculateMortgagePayment(
                    scenario.mortgageAmount,
                    scenario.rate,
                    scenario.amortizationYears + (scenario.amortizationMonths / 12),
                    scenario.paymentFrequency
                );
                
                // Update DOM
                $(`.term-box[data-scenario="${scenario.id}"] .amortization-years select`).val(scenario.amortizationYears);
                $(`.term-box[data-scenario="${scenario.id}"] .amortization-months select`).val(scenario.amortizationMonths);
                $(`.payment-box[data-scenario="${scenario.id}"] .payment-amount span`).text(formatCurrency(scenario.paymentAmount));
            }
        });
    }

    // Update rate for a scenario
    function updateScenarioRate(scenarioId, newRate) {
        const scenario = initialValues.scenarios.find(s => s.id === parseInt(scenarioId));
        if (scenario) {
            scenario.rate = parseFloat(newRate);
            
            // Recalculate the scenario values
            recalculateScenarioTermValues(scenario);
            
            // Update the display
            updateScenarioDisplay(scenario);
        }
    }

    // Update term years for a scenario
    function updateScenarioTermYears(scenarioId, years) {
        const scenario = initialValues.scenarios.find(s => s.id === scenarioId);
        
        // Update values in initialValues
        scenario.termYears = years;
        
        // No need to recalculate anything as we're using fixed values for the comparison
        // Just update the comparison results
        updateComparisonResults();
    }
    
    // Update rate type for a scenario
    function updateScenarioRateType(scenarioId, rateType) {
        const scenario = initialValues.scenarios.find(s => s.id === scenarioId);
        
        // Update values in initialValues
        scenario.termType = rateType;
        
        // No need to recalculate anything as we're using fixed values for the comparison
        // Just update the comparison results
        updateComparisonResults();
    }

    // Update payment frequency for a scenario
    function updateScenarioPaymentFrequency(scenarioId, frequency) {
        const scenario = initialValues.scenarios.find(s => s.id === scenarioId);
        
        // Update values in initialValues
        scenario.paymentFrequency = frequency;
        
        // Recalculate payment
        scenario.paymentAmount = calculateMortgagePayment(
            scenario.mortgageAmount,
            scenario.rate,
            scenario.amortizationYears + (scenario.amortizationMonths / 12),
            frequency
        );
        
        // Update DOM
        $(`.payment-box[data-scenario="${scenarioId}"] .payment-amount span`).text(formatCurrency(scenario.paymentAmount));
    }

    // Toggle scenario active state
    function toggleScenarioActive(scenarioId) {
        // Update all scenarios
        initialValues.scenarios.forEach(scenario => {
            if (scenario.id === scenarioId) {
                scenario.isActive = true;
                $(`.scenario-box[data-scenario="${scenario.id}"]`).addClass('active');
            } else {
                scenario.isActive = false;
                $(`.scenario-box[data-scenario="${scenario.id}"]`).removeClass('active');
            }
        });
    }

    // Toggle scenario star
    function toggleScenarioStar(scenarioId) {
        const scenario = initialValues.scenarios.find(s => s.id === scenarioId);
        scenario.isStarred = !scenario.isStarred;
        
        if (scenario.isStarred) {
            $(`.scenario-box[data-scenario="${scenarioId}"] .star-icon`).text('★').addClass('active');
        } else {
            $(`.scenario-box[data-scenario="${scenarioId}"] .star-icon`).text('☆').removeClass('active');
        }
    }

    // Update home expenses
    function updateHomeExpenses() {
        // Get expense values
        const propertyTax = parseFloat($('#property-tax').val().replace(/[^0-9.-]+/g, '')) || 0;
        const condoFees = parseFloat($('#condo-fees').val().replace(/[^0-9.-]+/g, '')) || 0;
        const heat = parseFloat($('#heat').val().replace(/[^0-9.-]+/g, '')) || 0;
        
        // Update home expenses in initialValues
        initialValues.homeExpenses.propertyTax = propertyTax;
        initialValues.homeExpenses.condoFees = condoFees;
        initialValues.homeExpenses.heat = heat;
        
        // No need to recalculate mortgage values, just update the Total Monthly Cost tab if it's active
        if ($('.tab-btn:contains("Total Monthly Cost")').hasClass('active')) {
            updateComparisonResults();
        }
    }
    
    // Calculate total monthly expenses
    function updateMonthlyExpenses() {
        // Calculate monthly property tax
        const monthlyPropertyTax = initialValues.homeExpenses.propertyTax / 12;
        
        // Add to each scenario
        initialValues.scenarios.forEach(scenario => {
            scenario.monthlyPropertyTax = monthlyPropertyTax;
            scenario.monthlyCostInclExpenses = scenario.paymentAmount + 
                monthlyPropertyTax + 
                initialValues.homeExpenses.condoFees + 
                initialValues.homeExpenses.heat;
                
            // Update DOM if needed
            // Update monthly cost display if it exists
        });
    }

    // Event Handlers
    
    // Home Price input change
    $('#home-price').on('input', function() {
        updateHomePrice();
    });

    // Property Tax input change
    $('#property-tax').on('input', function() {
        let value = $(this).val().replace(/[^0-9.-]+/g, '');
        if (value) {
            value = parseFloat(value);
            $(this).val(formatCurrency(value));
            updateHomeExpenses();
        }
    });

    // Condo Fees input change
    $('#condo-fees').on('input', function() {
        let value = $(this).val().replace(/[^0-9.-]+/g, '');
        if (value) {
            value = parseFloat(value);
            $(this).val(formatCurrency(value));
            updateHomeExpenses();
        }
    });

    // Heat input change
    $('#heat').on('input', function() {
        let value = $(this).val().replace(/[^0-9.-]+/g, '');
        if (value) {
            value = parseFloat(value);
            $(this).val(formatCurrency(value));
            updateHomeExpenses();
        }
    });

    // Toggle between Multiple and Single modes for expenses
    $('.home-expenses-header .toggle-option').on('click', function() {
        $(this).siblings().removeClass('active');
        $(this).addClass('active');
        
        // Apply the same expenses to all scenarios if Single mode is selected
        if ($(this).text() === 'Single') {
            // Show message that expenses will be applied to all scenarios
            alert('Expenses will be applied to all scenarios');
        }
    });

    // Down Payment Percentage dropdown change
    $('[id^="down-payment-percentage-"]').on('change', function() {
        const scenarioId = parseInt($(this).attr('id').split('-')[3]);
        console.log("Down payment percentage changed for scenario: " + scenarioId + ", value: " + $(this).val());
        updateScenarioDownPaymentPercentage(scenarioId);
    });

    // Down Payment input change
    $('[id^="down-payment-"]').not('[id^="down-payment-percentage-"]').on('input', function() {
        const scenarioId = parseInt($(this).attr('id').split('-')[2]);
        let value = $(this).val().replace(/[^0-9.-]+/g, '');
        if (value) {
            value = parseFloat(value);
            $(this).val(formatCurrency(value));
            updateScenarioDownPayment(scenarioId);
        }
    });

    // Apply Down Payment to All button click
    $('.down-payment .apply-all').on('click', function() {
        const scenarioId = parseInt($(this).closest('.scenario-panel').attr('data-scenario'));
        applyDownPaymentToAll(scenarioId);
    });

    // Rate input change
    $('.rate-input input').on('input', function() {
        const scenarioId = parseInt($(this).closest('.scenario-panel').attr('data-scenario'));
        let value = $(this).val().replace(/[^0-9.]+/g, '');
        if (value) {
            value = parseFloat(value);
            $(this).val(value.toFixed(2) + '%');
            updateScenarioRate(scenarioId, value);
        }
    });
    
    // Term selection change
    $('.term-select').on('change', function() {
        const scenarioId = parseInt($(this).closest('.scenario-panel').attr('data-scenario'));
        const years = parseInt($(this).val());
        updateScenarioTermYears(scenarioId, years);
    });
    
    // Rate type button click
    $('.rate-type-btn').on('click', function() {
        const scenarioId = parseInt($(this).closest('.scenario-panel').attr('data-scenario'));
        const rateType = $(this).data('rate-type');
        
        // Update button states
        $(this).siblings().removeClass('active');
        $(this).addClass('active');
        
        // Update scenario
        updateScenarioRateType(scenarioId, rateType);
    });

    // Amortization Years change
    $('.amortization-years select').on('change', function() {
        const scenarioId = parseInt($(this).closest('.scenario-panel').attr('data-scenario'));
        const years = parseInt($(this).val());
        const months = parseInt($(this).closest('.amortization-box').find('.amortization-months select').val());
        updateScenarioAmortization(scenarioId, years, months);
    });

    // Amortization Months change
    $('.amortization-months select').on('change', function() {
        const scenarioId = parseInt($(this).closest('.scenario-panel').attr('data-scenario'));
        const months = parseInt($(this).val());
        const years = parseInt($(this).closest('.amortization-box').find('.amortization-years select').val());
        updateScenarioAmortization(scenarioId, years, months);
    });

    // Apply Amortization to All button click
    $('.amortization-box .apply-all').on('click', function() {
        const scenarioId = parseInt($(this).closest('.scenario-panel').attr('data-scenario'));
        applyAmortizationToAll(scenarioId);
    });

    // Payment Frequency change
    $('.frequency-dropdown select').on('change', function() {
        const scenarioId = parseInt($(this).closest('.scenario-panel').attr('data-scenario'));
        const frequency = $(this).val();
        updateScenarioPaymentFrequency(scenarioId, frequency);
    });

    // Update scenario box click handler to toggle active state and panel visibility
    $('.scenario-box').off('click').on('click', function(e) {
        // Ignore clicks on checkboxes and their labels
        if ($(e.target).is('input[type="checkbox"], label')) {
            return;
        }
        
        const scenarioId = parseInt($(this).attr('data-scenario'));
        const scenario = initialValues.scenarios.find(s => s.id === scenarioId);
        const scenarioPanel = $(this).closest('.scenario-panel');
        
        // Toggle active state in data model
        scenario.isActive = !scenario.isActive;
        
        // Update UI for the info box
        $(this).toggleClass('active');
        
        // Toggle visibility of the entire panel
        if (scenario.isActive) {
            scenarioPanel.slideDown(); // Or .show()
        } else {
            scenarioPanel.slideUp(); // Or .hide()
        }
        
        // No comparison results to update
        // updateComparisonResults(); 
    });

    // Update star icon click handler - No comparison results to update
    $('.star-icon').off('click').on('click', function(e) {
        e.stopPropagation();
        const scenarioId = parseInt($(this).closest('.scenario-box').attr('data-scenario'));
        const scenario = initialValues.scenarios.find(s => s.id === scenarioId);
        
        // Only one scenario can be starred
        initialValues.scenarios.forEach(s => s.isStarred = (s.id === scenarioId) ? !s.isStarred : false);

        // Update UI for all star icons
         $('.star-icon').removeClass('active').text('☆');
         initialValues.scenarios.forEach(s => {
             if(s.isStarred) {
                 $(`.scenario-box[data-scenario='${s.id}'] .star-icon`).addClass('active').text('★');
             }
         });
        
        // No comparison results to update
        // updateComparisonResults(); 
    });

    // Tab clicks
    $('.tab').on('click', function() {
        const tabId = $(this).data('tab');
        
        // Update active tab
        $('.tab').removeClass('active');
        $(this).addClass('active');
        
        // Show relevant content
        $('.tab-content').hide();
        $(`#${tabId}`).show();
    });

    // Comparison Results Tab Button clicks
    $('.tab-btn').on('click', function() {
        // Update active tab button
        $('.tab-btn').removeClass('active');
        $(this).addClass('active');
        
        // Get the tab text
        const tabText = $(this).text();
        
        // Update the comparison header to match the selected tab
        $('.comparison-header h2').text(tabText);
        
        // Handle specific tab functionality
        if (tabText.includes("Total Monthly Cost")) {
            // Update to include home expenses
            updateComparisonWithMonthlyExpenses();
        } else {
            // Just update with standard principal & interest
            updateComparisonResults();
        }
    });

    // Show Differences toggle
    $('#show-differences').on('change', function() {
        const showDifferences = $(this).is(':checked');
        
        // Check which tab is active to determine what values to compare
        const activeTabText = $('.tab-btn.active').text();
        
        if (showDifferences) {
            if (activeTabText.includes("Total Monthly Cost")) {
                showMonthlyExpenseDifferences();
            } else {
                showPrincipalInterestDifferences();
            }
        } else {
            // Reset to normal values based on active tab
            if (activeTabText.includes("Total Monthly Cost")) {
                updateComparisonWithMonthlyExpenses();
            } else {
                updateComparisonResults();
            }
        }
    });
    
    // Show differences for principal and interest tab
    function showPrincipalInterestDifferences() {
        // Find base scenario (starred scenario)
        const baseScenario = initialValues.scenarios.find(s => s.isStarred);
        if (!baseScenario) return;
        
        // Get base scenario values
        const baseInterest = baseScenario.termInterest;
        const basePrincipal = baseScenario.termPrincipal;
        const basePayments = baseScenario.totalTermPayments;
        const baseBalance = baseScenario.balanceEndOfTerm;
        
        // Get active scenarios
        const activeScenarios = initialValues.scenarios.filter(s => s.isActive && !s.isStarred);
        
        // Compare active scenarios and show differences
        activeScenarios.forEach(scenario => {
            const scenarioId = scenario.id;
            
            // Calculate differences
            const interestDiff = scenario.termInterest - baseInterest;
            const principalDiff = scenario.termPrincipal - basePrincipal;
            const paymentsDiff = scenario.totalTermPayments - basePayments;
            const balanceDiff = scenario.balanceEndOfTerm - baseBalance;
            
            // Format and display differences with +/- sign
            const formatDiff = (diff, baseValue) => {
                const sign = diff >= 0 ? '+' : '-';
                const percentage = ((Math.abs(diff) / Math.abs(baseValue)) * 100).toFixed(1);
                return `${formatCurrency(Math.abs(diff))} (${sign}${percentage}%)`;
            };
            
            $(`.scenario${scenarioId} .comparison-item:nth-child(1) .item-value`).text(formatDiff(interestDiff, baseInterest));
            $(`.scenario${scenarioId} .comparison-item:nth-child(2) .item-value`).text(formatDiff(principalDiff, basePrincipal));
            $(`.scenario${scenarioId} .comparison-item:nth-child(3) .item-value`).text(formatDiff(paymentsDiff, basePayments));
            $(`.scenario${scenarioId} .comparison-item:nth-child(4) .item-value`).text(formatDiff(balanceDiff, baseBalance));
        });
        
        // Show base scenario values without differences
        $(`.scenario${baseScenario.id} .comparison-item:nth-child(1) .item-value`).text(formatCurrency(baseInterest));
        $(`.scenario${baseScenario.id} .comparison-item:nth-child(2) .item-value`).text(formatCurrency(basePrincipal));
        $(`.scenario${baseScenario.id} .comparison-item:nth-child(3) .item-value`).text(formatCurrency(basePayments));
        $(`.scenario${baseScenario.id} .comparison-item:nth-child(4) .item-value`).text(formatCurrency(baseBalance));
    }
    
    // Show differences for monthly expenses tab
    function showMonthlyExpenseDifferences() {
        // Find base scenario (starred scenario)
        const baseScenario = initialValues.scenarios.find(s => s.isStarred);
        if (!baseScenario) return;
        
        // Get monthly expenses
        const monthlyPropertyTax = initialValues.homeExpenses.propertyTax / 12;
        const monthlyCondoFees = initialValues.homeExpenses.condoFees;
        const monthlyHeat = initialValues.homeExpenses.heat;
        
        // Calculate base scenario total cost
        const baseMortgagePayment = baseScenario.paymentAmount;
        const baseTotalCost = baseMortgagePayment + monthlyPropertyTax + monthlyCondoFees + monthlyHeat;
        
        // Get active scenarios
        const activeScenarios = initialValues.scenarios.filter(s => s.isActive && !s.isStarred);
        
        // Compare active scenarios and show differences
        activeScenarios.forEach(scenario => {
            const scenarioId = scenario.id;
            
            // Calculate this scenario's total cost
            const mortgagePayment = scenario.paymentAmount;
            const totalCost = mortgagePayment + monthlyPropertyTax + monthlyCondoFees + monthlyHeat;
            
            // Calculate differences
            const paymentDiff = mortgagePayment - baseMortgagePayment;
            const totalDiff = totalCost - baseTotalCost;
            
            // Format and display differences with +/- sign
            const formatDiff = (diff, baseValue) => {
                const sign = diff >= 0 ? '+' : '-';
                const percentage = ((Math.abs(diff) / Math.abs(baseValue)) * 100).toFixed(1);
                return `${formatCurrency(Math.abs(diff))} (${sign}${percentage}%)`;
            };
            
            $(`.scenario${scenarioId} .comparison-item:nth-child(1) .item-value`).text(formatDiff(paymentDiff, baseMortgagePayment));
            $(`.scenario${scenarioId} .comparison-item:nth-child(2) .item-value`).text(formatCurrency(monthlyPropertyTax));
            $(`.scenario${scenarioId} .comparison-item:nth-child(3) .item-value`).text(formatCurrency(monthlyCondoFees + monthlyHeat));
            $(`.scenario${scenarioId} .comparison-item:nth-child(4) .item-value`).text(formatDiff(totalDiff, baseTotalCost));
        });
        
        // Show base scenario values without differences
        $(`.scenario${baseScenario.id} .comparison-item:nth-child(1) .item-value`).text(formatCurrency(baseMortgagePayment));
        $(`.scenario${baseScenario.id} .comparison-item:nth-child(2) .item-value`).text(formatCurrency(monthlyPropertyTax));
        $(`.scenario${baseScenario.id} .comparison-item:nth-child(3) .item-value`).text(formatCurrency(monthlyCondoFees + monthlyHeat));
        $(`.scenario${baseScenario.id} .comparison-item:nth-child(4) .item-value`).text(formatCurrency(baseTotalCost));
    }

    // Select Scenario button clicks
    $('.select-scenario-btn').on('click', function() {
        const scenarioBox = $(this).closest('.scenario-comparison-box');
        const scenarioId = parseInt(scenarioBox.attr('class').match(/scenario(\d+)/)[1]);
        
        // Update active state
        toggleScenarioActive(scenarioId);
        
        // Make this the base scenario
        initialValues.scenarios.forEach(s => {
            s.isStarred = (s.id === scenarioId);
        });
        
        // Update star icons
        $('.star-icon').removeClass('active').text('☆');
        $(`.scenario-box[data-scenario="${scenarioId}"] .star-icon`).addClass('active').text('★');
        
        // Update base scenario badge
        $('.base-scenario-badge').remove();
        $('.select-scenario-btn').show();
        
        scenarioBox.append('<div class="base-scenario-badge">Base Scenario</div>');
        scenarioBox.find('.select-scenario-btn').hide();
        
        // Update comparison results
        updateComparisonResults();
    });

    // Create Report button click
    $('.create-report').on('click', function() {
        alert('Report generation would be implemented here.');
    });

    // Add Scenario button click
    $('.add-scenario').on('click', function() {
        alert('Adding a new scenario would be implemented here.');
    });

    // Calculate and update comparison results
    function updateComparisonResults() {
        // Get active scenarios
        const activeScenarios = initialValues.scenarios.filter(s => s.isActive);
        
        // Update comparison display based on active scenarios
        activeScenarios.forEach(scenario => {
            const scenarioId = scenario.id;
            
            // Update values in the comparison panel
            $(`.scenario${scenarioId} .comparison-item:nth-child(1) .item-value`).text(formatCurrency(scenario.termInterest));
            $(`.scenario${scenarioId} .comparison-item:nth-child(2) .item-value`).text(formatCurrency(scenario.termPrincipal));
            $(`.scenario${scenarioId} .comparison-item:nth-child(3) .item-value`).text(formatCurrency(scenario.totalTermPayments));
            $(`.scenario${scenarioId} .comparison-item:nth-child(4) .item-value`).text(formatCurrency(scenario.balanceEndOfTerm));
            
            // Show the scenario's comparison panel
            $(`.scenario${scenarioId}`).show();
        });
        
        // Hide inactive scenarios
        initialValues.scenarios.filter(s => !s.isActive).forEach(scenario => {
            $(`.scenario${scenario.id}`).hide();
        });
        
        // Update comparison highlights if showing differences
        if ($('#show-differences').is(':checked')) {
            if ($('.tab-btn:contains("Total Monthly Cost")').hasClass('active')) {
                showMonthlyExpenseDifferences();
            } else {
                showPrincipalInterestDifferences();
            }
        }
    }
    
    function updateComparisonWithMonthlyExpenses() {
        // Get active scenarios
        const activeScenarios = initialValues.scenarios.filter(s => s.isActive);
        
        // Calculate monthly expenses
        const monthlyPropertyTax = initialValues.homeExpenses.propertyTax / 12;
        const monthlyCondoFees = initialValues.homeExpenses.condoFees;
        const monthlyHeat = initialValues.homeExpenses.heat;
        
        // Update comparison display based on active scenarios
        activeScenarios.forEach(scenario => {
            const scenarioId = scenario.id;
            const totalCost = scenario.paymentAmount + monthlyPropertyTax + monthlyCondoFees + monthlyHeat;
            
            // Update values in the comparison panel
            $(`.scenario${scenarioId} .comparison-item:nth-child(1) .item-value`).text(formatCurrency(scenario.paymentAmount));
            $(`.scenario${scenarioId} .comparison-item:nth-child(2) .item-value`).text(formatCurrency(monthlyPropertyTax));
            $(`.scenario${scenarioId} .comparison-item:nth-child(3) .item-value`).text(formatCurrency(monthlyCondoFees + monthlyHeat));
            $(`.scenario${scenarioId} .comparison-item:nth-child(4) .item-value`).text(formatCurrency(totalCost));
            
            // Show the scenario's comparison panel
            $(`.scenario${scenarioId}`).show();
        });
        
        // Hide inactive scenarios
        initialValues.scenarios.filter(s => !s.isActive).forEach(scenario => {
            $(`.scenario${scenario.id}`).hide();
        });
        
        // Update comparison highlights if showing differences
        if ($('#show-differences').is(':checked')) {
            showMonthlyExpenseDifferences();
        }
    }

    // Initialize the calculator
    function initializeCalculator() {
        // Initialize all scenarios with the correct values
        initialValues.scenarios.forEach(scenario => {
            // Use initial values from the model
            scenario.mortgageAmount = 463950;
            scenario.rate = 5.25;
            scenario.termYears = 5; // Default to 5 years
            scenario.termType = "fixed"; // Default to fixed rate
            scenario.amortizationYears = 25;
            scenario.amortizationMonths = 0;
            scenario.paymentFrequency = "monthly";
            
            // Set all scenarios to active by default
            scenario.isActive = true;
            
            // Calculate the actual payment and term values
            recalculateScenarioTermValues(scenario);
            
            // Update DOM with initial values
            $(`#down-payment-${scenario.id}`).val(formatCurrency(scenario.downPaymentAmount));
            
            // Make sure the correct dropdown option is selected
            $(`#down-payment-percentage-${scenario.id}`).val(scenario.downPaymentPercentage.toString());
            
            $(`.mortgage-box[data-scenario="${scenario.id}"] .insurance-label`).text(`+ ${formatCurrency(scenario.mortgageInsurance)} Mortgage Insurance`);
            $(`.mortgage-box[data-scenario="${scenario.id}"] .amount`).text(formatCurrency(scenario.mortgageAmount));
            $(`.rate-input input[data-scenario="${scenario.id}"]`).val(scenario.rate.toFixed(2) + '%');
            
            // Set term years selection
            $(`.term-select[data-scenario="${scenario.id}"]`).val(scenario.termYears);
            
            // Set rate type buttons
            $(`.rate-type-btn[data-scenario="${scenario.id}"]`).removeClass('active');
            $(`.rate-type-btn[data-scenario="${scenario.id}"][data-rate-type="${scenario.termType}"]`).addClass('active');
            
            // Set amortization values
            $(`.amortization-box[data-scenario="${scenario.id}"] .amortization-years select`).val(scenario.amortizationYears);
            $(`.amortization-box[data-scenario="${scenario.id}"] .amortization-months select`).val(scenario.amortizationMonths);
            
            // Set payment amount
            $(`.payment-box[data-scenario="${scenario.id}"] .payment-amount span`).text(formatCurrency(scenario.paymentAmount));
            
            // Set payment frequency
            $(`.payment-box[data-scenario="${scenario.id}"] .frequency-dropdown select`).val(scenario.paymentFrequency);
            
            // Set checkbox states
            $(`#first-time-${scenario.id}`).prop('checked', scenario.isFirstTimeBuyer);
            $(`#newly-built-${scenario.id}`).prop('checked', scenario.isNewlyBuiltHome);
            
            // Set initial visibility - all scenarios visible by default
            $(`.scenario-panel[data-scenario="${scenario.id}"]`).show();
            $(`.scenario-box[data-scenario="${scenario.id}"]`).addClass('active');
            
            // Set star state
            if (scenario.isStarred) {
                $(`.scenario-box[data-scenario="${scenario.id}"] .star-icon`).text('★').addClass('active');
            } else {
                $(`.scenario-box[data-scenario="${scenario.id}"] .star-icon`).text('☆').removeClass('active');
            }
        });
        
        // Initialize home expense input fields
        $('#property-tax').val(formatCurrency(initialValues.homeExpenses.propertyTax));
        $('#condo-fees').val(formatCurrency(initialValues.homeExpenses.condoFees));
        $('#heat').val(formatCurrency(initialValues.homeExpenses.heat));
        
        // Update comparison results
        updateComparisonResults();
    }
    
    // Recalculate scenario term values
    function recalculateScenarioTermValues(scenario) {
        const homePrice = parseFloat($('#home-price').val().replace(/[^0-9.-]+/g, '')) || initialValues.homePrice;
        const downPaymentAmount = Math.round(homePrice * (scenario.downPaymentPercentage / 100));
        const mortgageInsurance = calculateMortgageInsurance(homePrice, scenario.downPaymentPercentage);
        const mortgageAmount = calculateMortgageAmount(homePrice, downPaymentAmount, mortgageInsurance);
        
        // Update scenario values
        scenario.downPaymentAmount = downPaymentAmount;
        scenario.mortgageInsurance = mortgageInsurance;
        scenario.mortgageAmount = mortgageAmount;
        
        // Calculate payment amount
        scenario.paymentAmount = calculateMortgagePayment(
            mortgageAmount,
            scenario.rate,
            scenario.amortizationYears + (scenario.amortizationMonths / 12),
            scenario.paymentFrequency
        );
        
        // Calculate term values (simplified for this example)
        const termMonths = scenario.termYears * 12;
        const monthlyRate = scenario.rate / 100 / 12;
        const monthlyPayment = scenario.paymentAmount;
        
        // Calculate term interest and principal
        let balance = mortgageAmount;
        let totalInterest = 0;
        let totalPrincipal = 0;
        
        for (let i = 0; i < termMonths; i++) {
            const interestPayment = balance * monthlyRate;
            const principalPayment = monthlyPayment - interestPayment;
            
            totalInterest += interestPayment;
            totalPrincipal += principalPayment;
            balance -= principalPayment;
        }
        
        scenario.termInterest = Math.round(totalInterest * 100) / 100;
        scenario.termPrincipal = Math.round(totalPrincipal * 100) / 100;
        scenario.totalTermPayments = Math.round((totalInterest + totalPrincipal) * 100) / 100;
        scenario.balanceEndOfTerm = Math.round(balance * 100) / 100;
    }

    // Update the rate input handling
    function initializeRateInputs() {
        // Enable rate editing for all scenarios
        $('.rate-input input').each(function() {
            // Remove readonly attribute if it exists
            $(this).prop('readonly', false);
            
            // Handle input changes
            $(this).on('input', function() {
                const scenarioId = $(this).data('scenario');
                let value = $(this).val().replace(/[^\d.]/g, ''); // Allow only numbers and decimal
                
                // Validate rate input
                if (value !== '') {
                    value = Math.min(Math.max(parseFloat(value), 0), 100); // Limit between 0-100
                    $(this).val(value.toFixed(2) + '%');
                    
                    // Update the scenario's rate
                    updateScenarioRate(scenarioId, value);
                }
            });
            
            // Handle blur event to ensure proper formatting
            $(this).on('blur', function() {
                const value = parseFloat($(this).val()) || 0;
                $(this).val(value.toFixed(2) + '%');
            });
        });
    }

    // Update the scenario display
    function updateScenarioDisplay(scenario) {
        // Update payment amount
        $(`.payment-amount[data-scenario="${scenario.id}"]`).text(formatCurrency(scenario.paymentAmount));
        
        // Update term values
        $(`.term-interest[data-scenario="${scenario.id}"]`).text(formatCurrency(scenario.termInterest));
        $(`.term-principal[data-scenario="${scenario.id}"]`).text(formatCurrency(scenario.termPrincipal));
        $(`.term-total[data-scenario="${scenario.id}"]`).text(formatCurrency(scenario.totalTermPayments));
        $(`.term-balance[data-scenario="${scenario.id}"]`).text(formatCurrency(scenario.balanceEndOfTerm));
        
        // Update comparison highlights if needed
        updateComparisonHighlights();
    }

    // Scenario button click handlers
    $('.scenario-button').on('click', function() {
        const scenarioId = parseInt($(this).data('scenario'));
        const scenario = initialValues.scenarios.find(s => s.id === scenarioId);
        
        // Toggle active state
        scenario.isActive = !scenario.isActive;
        
        // Update UI
        $(this).toggleClass('active');
        $(`.scenario-panel[data-scenario="${scenarioId}"]`).toggleClass('active');
        
        // Update comparison results
        updateComparisonResults();
    });

    // Star button click handlers
    $('.star-button').on('click', function() {
        const scenarioId = parseInt($(this).data('scenario'));
        const scenario = initialValues.scenarios.find(s => s.id === scenarioId);
        
        // Toggle starred state
        scenario.isStarred = !scenario.isStarred;
        
        // Update UI
        $(this).toggleClass('active');
        
        // Update comparison results
        updateComparisonResults();
    });

    // Initialize UI elements
    function initializeUI() {
        // Set initial home price
        $('#home-price').val(formatCurrency(initialValues.homePrice));
        
        // Initialize scenarios
        initialValues.scenarios.forEach(scenario => {
            const scenarioPanel = $(`.scenario-panel[data-scenario="${scenario.id}"]`);
            const scenarioBox = $(`.scenario-box[data-scenario="${scenario.id}"]`);
            
            // Set initial values in input fields
            $(`#down-payment-${scenario.id}`).val(formatCurrency(scenario.downPaymentAmount));
            $(`#down-payment-percentage-${scenario.id}`).val(scenario.downPaymentPercentage);
            $(`.mortgage-box[data-scenario="${scenario.id}"] .insurance-label`).text(`+ ${formatCurrency(scenario.mortgageInsurance)} Mortgage Insurance`);
            $(`.mortgage-box[data-scenario="${scenario.id}"] .amount`).text(formatCurrency(scenario.mortgageAmount));
            $(`.payment-box[data-scenario="${scenario.id}"] .payment-amount span`).text(formatCurrency(scenario.paymentAmount));
            $(`.rate-input input[data-scenario="${scenario.id}"]`).val(scenario.rate.toFixed(2) + '%');
            $(`.term-select[data-scenario="${scenario.id}"]`).val(scenario.termYears);
            $(`.term-box[data-scenario="${scenario.id}"] .amortization-years select`).val(scenario.amortizationYears);
             $(`.amortization-box[data-scenario="${scenario.id}"] .amortization-years select`).val(scenario.amortizationYears);
        });
        
        // Initialize home expense input fields
        $('#property-tax').val(formatCurrency(initialValues.homeExpenses.propertyTax));
        $('#condo-fees').val(formatCurrency(initialValues.homeExpenses.condoFees));
        $('#heat').val(formatCurrency(initialValues.homeExpenses.heat));
        
        // Update comparison results
        updateComparisonResults();
    }

    // Initialize UI on page load
    $(document).ready(function() {
        initializeCalculator();
        initializeRateInputs();
        
        // Add event listeners for scenario boxes
        $('.scenario-box').on('click', function(e) {
            // Ignore clicks on checkboxes and their labels
            if ($(e.target).is('input[type="checkbox"], label')) {
                return;
            }
            
            const scenarioId = parseInt($(this).attr('data-scenario'));
            const scenario = initialValues.scenarios.find(s => s.id === scenarioId);
            
            // Toggle active state
            scenario.isActive = !scenario.isActive;
            
            // Update UI
            $(this).toggleClass('active');
            $(`.scenario-panel[data-scenario="${scenarioId}"]`).toggle();
            
            // Update comparison results
            updateComparisonResults();
        });
        
        // Add event handler for checkboxes
        $('.option-checkbox input[type="checkbox"]').on('change', function(e) {
            e.stopPropagation();
            const scenarioId = parseInt($(this).closest('.scenario-box').attr('data-scenario'));
            const scenario = initialValues.scenarios.find(s => s.id === scenarioId);
            const checkboxId = $(this).attr('id');
            
            // Update the appropriate flag in the scenario
            if (checkboxId.startsWith('first-time-')) {
                scenario.isFirstTimeBuyer = $(this).is(':checked');
            } else if (checkboxId.startsWith('newly-built-')) {
                scenario.isNewlyBuiltHome = $(this).is(':checked');
            }
        });

        // Add event handler for checkbox labels
        $('.option-checkbox label').on('click', function(e) {
            e.stopPropagation();
        });
        
        // Add event listeners for star icons
        $('.star-icon').on('click', function(e) {
            e.stopPropagation();
            const scenarioId = parseInt($(this).closest('.scenario-box').attr('data-scenario'));
            
            // Only one scenario can be starred
            initialValues.scenarios.forEach(s => {
                s.isStarred = (s.id === scenarioId) ? !s.isStarred : false;
            });
            
            // Update UI
            $('.star-icon').removeClass('active').text('☆');
            initialValues.scenarios.forEach(s => {
                if (s.isStarred) {
                    $(`.scenario-box[data-scenario="${s.id}"] .star-icon`).addClass('active').text('★');
                }
            });
            
            // Update comparison results
            updateComparisonResults();
        });
        
        // Add event listeners for down payment percentage changes
        $('[id^="down-payment-percentage-"]').on('change', function() {
            const scenarioId = parseInt($(this).attr('id').split('-')[3]);
            updateScenarioDownPaymentPercentage(scenarioId);
        });
        
        // Add event listeners for down payment amount changes
        $('[id^="down-payment-"]').not('[id^="down-payment-percentage-"]').on('input', function() {
            const scenarioId = parseInt($(this).attr('id').split('-')[2]);
            let value = $(this).val().replace(/[^0-9.-]+/g, '');
            if (value) {
                value = parseFloat(value);
                $(this).val(formatCurrency(value));
                updateScenarioDownPayment(scenarioId);
            }
        });
        
        // Add event listeners for apply all buttons
        $('.apply-all').on('click', function() {
            const scenarioId = parseInt($(this).closest('.scenario-panel').attr('data-scenario'));
            if ($(this).closest('.down-payment').length) {
                applyDownPaymentToAll(scenarioId);
            } else if ($(this).closest('.amortization-box').length) {
                applyAmortizationToAll(scenarioId);
            }
        });
        
        // Add event listeners for rate type buttons
        $('.rate-type-btn').on('click', function() {
            const scenarioId = parseInt($(this).closest('.scenario-panel').attr('data-scenario'));
            const rateType = $(this).data('rate-type');
            
            // Update button states
            $(this).siblings().removeClass('active');
            $(this).addClass('active');
            
            // Update scenario
            updateScenarioRateType(scenarioId, rateType);
        });
        
        // Add event listeners for term selection
        $('.term-select').on('change', function() {
            const scenarioId = parseInt($(this).closest('.scenario-panel').attr('data-scenario'));
            const years = parseInt($(this).val());
            updateScenarioTermYears(scenarioId, years);
        });
        
        // Add event listeners for payment frequency
        $('.frequency-dropdown select').on('change', function() {
            const scenarioId = parseInt($(this).closest('.scenario-panel').attr('data-scenario'));
            const frequency = $(this).val();
            updateScenarioPaymentFrequency(scenarioId, frequency);
        });
        
        // Add event listeners for amortization changes
        $('.amortization-years select, .amortization-months select').on('change', function() {
            const scenarioId = parseInt($(this).closest('.scenario-panel').attr('data-scenario'));
            const years = parseInt($(this).closest('.amortization-box').find('.amortization-years select').val());
            const months = parseInt($(this).closest('.amortization-box').find('.amortization-months select').val());
            updateScenarioAmortization(scenarioId, years, months);
        });
        
        // Add event listeners for home price changes
        $('#home-price').on('input', function() {
            updateHomePrice();
        });
        
        // Add event listeners for home expenses
        $('#property-tax, #condo-fees, #heat').on('input', function() {
            let value = $(this).val().replace(/[^0-9.-]+/g, '');
            if (value) {
                value = parseFloat(value);
                $(this).val(formatCurrency(value));
                updateHomeExpenses();
            }
        });
        
        // Add event listeners for create report button
        $('.create-report').on('click', function() {
            alert('Report generation would be implemented here.');
        });
    });
});