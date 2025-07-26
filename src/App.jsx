import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button.jsx';

// Main App component for the Composite Distress Score (CDS) Framework Prototype
const App = () => {
    // State to store the input values for each indicator
    const [indicatorValues, setIndicatorValues] = useState({
        hunger: 2500, // Caloric intake per capita (0-4000 kcal/day)
        inequality: 40, // Gini index (0-100)
        conflict: 10, // Deaths per 100,000
        displacement: 200, // IDPs + refugees per 100,000
        governance: 50, // Freedom House Score (0-100)
        suicide: 5, // Suicides per 100,000
    });

    // State to store the normalized scores for each indicator
    const [normalizedScores, setNormalizedScores] = useState({});
    // State to store the final Composite Distress Score (CDS)
    const [cdsScore, setCdsScore] = useState(null);
    // State to store the interpretation of the CDS (now hardcoded based on ranges)
    const [interpretation, setInterpretation] = useState('');
    // State to manage loading status (kept for consistency, though interpretation is hardcoded)
    const [isLoading, setIsLoading] = useState(false);
    // State to store any error messages
    const [error, setError] = useState('');

    // State for adaptive weighting
    // Learning rate (eta) is set to 0.1 to make adaptive weight changes more noticeable
    const [learningRate, setLearningRate] = useState(0.1); 
    // Weights are initialized to an empty object and will be set to equal weights on first calculation
    const [weights, setWeights] = useState({}); 
    const [weightingMode, setWeightingMode] = useState('equal'); // 'equal' or 'adaptive'

    // Define the indicators and their properties for easier rendering and calculation
    const indicators = [
        { id: 'hunger', name: 'Hunger (Caloric Intake)', unit: 'kcal/day', min: 0, max: 4000, placeholder: 'e.g., 2500' },
        { id: 'inequality', name: 'Inequality (Gini Index)', unit: '', min: 0, max: 100, placeholder: 'e.g., 40' },
        // Conflict Deaths: Max set to 100,000 to differentiate extreme high values
        { id: 'conflict', name: 'Conflict Deaths', unit: 'per 100k', min: 0, max: 100000, placeholder: 'e.g., 10' }, 
        // Displacement: Max set to 100,000 to differentiate extreme high values
        { id: 'displacement', name: 'Displacement', unit: 'per 100k', min: 0, max: 100000, placeholder: 'e.g., 200' }, 
        { id: 'governance', name: 'Governance (Freedom House Score)', unit: '', min: 0, max: 100, placeholder: 'e.g., 50' },
        // Suicide: Max set to 100 to allow more differentiation than 50
        { id: 'suicide', name: 'Mental Health (Suicides)', unit: 'per 100k', min: 0, max: 100, placeholder: 'e.g., 5' }, 
    ];

    // Function to normalize an individual indicator's value based on its type
    const normalizeIndicator = useCallback((value, id) => {
        let score = 0;
        switch (id) {
            case 'hunger':
                score = 1 - (value / 4000);
                break;
            case 'inequality':
                score = value / 100;
                break;
            case 'conflict':
                // Normalizes to 1 at 100,000 deaths per 100k
                score = Math.min(1, value / 100000); 
                break;
            case 'displacement':
                // Normalizes to 1 at 100,000 IDPs + refugees per 100k
                score = Math.min(1, value / 100000); 
                break;
            case 'governance':
                score = 1 - (value / 100);
                break;
            case 'suicide':
                // Normalizes to 1 at 100 suicides per 100k
                score = Math.min(1, value / 100); 
                break;
            default:
                score = 0;
        }
        return Math.max(0, Math.min(1, score));
    }, []);

    // Function to handle changes in the input fields
    const handleInputChange = (e) => {
        const { id, value } = e.target;
        // Allow empty string for clearing input, otherwise convert to float
        setIndicatorValues(prev => ({
            ...prev,
            [id]: value === '' ? '' : parseFloat(value)
        }));
    };

    // Function to generate hardcoded interpretation based on CDS score
    const generateInterpretation = useCallback((score) => {
        if (score < 0.2) {
            return `With a CDS of ${score.toFixed(3)}, this region shows minimal distress levels. The indicators suggest relatively stable conditions with low conflict, adequate nutrition, reasonable governance, and manageable displacement. This represents a favorable situation for human wellbeing.`;
        } else if (score < 0.4) {
            return `A CDS of ${score.toFixed(3)} indicates low to moderate distress. While the situation is generally manageable, there may be emerging concerns in some indicators that warrant monitoring. Preventive measures could help maintain stability.`;
        } else if (score < 0.6) {
            return `This CDS of ${score.toFixed(3)} reflects moderate distress levels. The region is experiencing notable challenges across multiple indicators. This suggests the need for targeted interventions to address specific areas of concern before conditions worsen.`;
        } else if (score < 0.8) {
            return `With a CDS of ${score.toFixed(3)}, this region shows high distress levels. Multiple indicators are signaling serious challenges that require immediate attention. Humanitarian assistance and policy interventions are likely needed to prevent further deterioration.`;
        } else {
            return `A CDS of ${score.toFixed(3)} indicates severe distress. This represents a crisis situation with multiple indicators showing critical levels. Urgent humanitarian intervention, international assistance, and comprehensive crisis response measures are essential.`;
        }
    }, []);

    // Core calculation logic for CDS and interpretation
    const calculateCdsAndInterpretation = useCallback(() => {
        setError('');
        setIsLoading(true);

        const currentNormalizedScores = {};
        indicators.forEach(indicator => {
            // Ensure value is a number for normalization, defaulting to 0 if input is empty string
            const value = indicatorValues[indicator.id] === '' ? 0 : Number(indicatorValues[indicator.id]);
            currentNormalizedScores[indicator.id] = normalizeIndicator(value, indicator.id);
        });
        setNormalizedScores(currentNormalizedScores);

        let totalCds = 0;
        let newCalculatedWeights = {}; 

        if (weightingMode === 'equal') {
            const equalWeight = 1 / indicators.length;
            indicators.forEach(indicator => {
                newCalculatedWeights[indicator.id] = equalWeight;
                totalCds += currentNormalizedScores[indicator.id] * equalWeight;
            });
        } else { // Adaptive weighting
            let sumOfNumerator = 0;
            const tempWeights = {}; 

            indicators.forEach(indicator => {
                // Use previous weight if available, otherwise start with equal weight (initial condition)
                const prevWeight = weights[indicator.id] !== undefined ? weights[indicator.id] : (1 / indicators.length);
                const numerator = prevWeight + learningRate * currentNormalizedScores[indicator.id];
                tempWeights[indicator.id] = numerator;
                sumOfNumerator += numerator;
            });

            // Normalize new weights
            indicators.forEach(indicator => {
                newCalculatedWeights[indicator.id] = tempWeights[indicator.id] / sumOfNumerator;
                totalCds += currentNormalizedScores[indicator.id] * newCalculatedWeights[indicator.id];
            });
        }

        // Only update weights state if they are actually different to prevent unnecessary re-renders
        if (JSON.stringify(newCalculatedWeights) !== JSON.stringify(weights)) {
            setWeights(newCalculatedWeights);
        }
        
        setCdsScore(totalCds);
        setInterpretation(generateInterpretation(totalCds));
        setIsLoading(false);
    }, [indicatorValues, normalizeIndicator, generateInterpretation, indicators, learningRate, weightingMode, weights]); 

    // Effect to trigger calculation when relevant inputs change
    useEffect(() => {
        calculateCdsAndInterpretation();
    }, [indicatorValues, weightingMode, calculateCdsAndInterpretation]); 

    // Function to explicitly apply adaptive weights (useful for seeing step-by-step adaptation)
    const applyAdaptiveWeights = () => {
        calculateCdsAndInterpretation(); 
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 sm:p-6 md:p-8 font-sans">
            <div className="bg-white p-6 sm:p-8 md:p-10 rounded-xl shadow-2xl w-full max-w-4xl border border-gray-200">
                <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-gray-800 mb-6 sm:mb-8">
                    Composite Distress Score (CDS) Prototype
                </h1>
                <p className="text-center text-gray-600 mb-8 leading-relaxed">
                    This interactive prototype demonstrates the calculation of the Composite Distress Score (CDS)
                    based on synthetic indicator values. It now includes both **Equal** and **Adaptive Weighting** modes.
                </p>

                {/* Input Section */}
                <div className="mb-8 p-4 sm:p-6 bg-blue-50 rounded-lg border border-blue-200">
                    <h2 className="text-2xl font-bold text-blue-800 mb-4">1. Input Indicators</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {indicators.map(indicator => (
                            <div key={indicator.id} className="flex flex-col">
                                <label htmlFor={indicator.id} className="text-sm font-medium text-gray-700 mb-1">
                                    {indicator.name} {indicator.unit ? `(${indicator.unit})` : ''}
                                </label>
                                <input
                                    type="number"
                                    id={indicator.id}
                                    value={indicatorValues[indicator.id]}
                                    onChange={handleInputChange}
                                    min={indicator.min}
                                    max={indicator.max}
                                    placeholder={indicator.placeholder}
                                    className="p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm transition duration-150 ease-in-out"
                                />
                                <span className="text-xs text-gray-500 mt-1">
                                    Range: {indicator.min}-{indicator.max}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Weighting Mode Selection */}
                <div className="mb-8 p-4 sm:p-6 bg-yellow-50 rounded-lg border border-yellow-200">
                    <h2 className="text-2xl font-bold text-yellow-800 mb-4">2. Weighting Mode</h2>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
                        <label className="flex items-center cursor-pointer">
                            <input
                                type="radio"
                                name="weightingMode"
                                value="equal"
                                checked={weightingMode === 'equal'}
                                onChange={() => setWeightingMode('equal')}
                                className="form-radio h-4 w-4 text-yellow-600 transition duration-150 ease-in-out"
                            />
                            <span className="ml-2 text-gray-700 font-medium">Equal Weighting</span>
                        </label>
                        <label className="flex items-center cursor-pointer">
                            <input
                                type="radio"
                                name="weightingMode"
                                value="adaptive"
                                checked={weightingMode === 'adaptive'}
                                onChange={() => setWeightingMode('adaptive')}
                                className="form-radio h-4 w-4 text-yellow-600 transition duration-150 ease-in-out"
                            />
                            <span className="ml-2 text-gray-700 font-medium">Adaptive Weighting</span>
                        </label>
                    </div>

                    {weightingMode === 'adaptive' && (
                        <div className="mt-4 flex flex-col sm:flex-row items-center gap-4">
                            <label htmlFor="learningRate" className="text-sm font-medium text-gray-700 flex-shrink-0">
                                Learning Rate ($\eta$):
                            </label>
                            <input
                                type="number"
                                id="learningRate"
                                value={learningRate}
                                onChange={(e) => setLearningRate(parseFloat(e.target.value) || 0)}
                                min="0"
                                step="0.01" // Allow for finer control of learning rate
                                className="p-2 border border-gray-300 rounded-md focus:ring-yellow-500 focus:border-yellow-500 shadow-sm w-full sm:w-auto"
                            />
                            <Button 
                                onClick={applyAdaptiveWeights}
                                className="w-full sm:w-auto bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-opacity-75"
                            >
                                Apply Adaptive Weights
                            </Button>
                        </div>
                    )}
                </div>

                {/* Calculated Scores Section */}
                <div className="mb-8 p-4 sm:p-6 bg-green-50 rounded-lg border border-green-200">
                    <h2 className="text-2xl font-bold text-green-800 mb-4">3. Calculated Scores</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        {indicators.map(indicator => (
                            <div key={`normalized-${indicator.id}`} className="bg-white p-3 rounded-md shadow-sm border border-gray-200">
                                <p className="text-sm font-medium text-gray-700">{indicator.name} (Normalized):</p>
                                <p className="text-lg font-semibold text-green-700">
                                    {normalizedScores[indicator.id] !== undefined ? normalizedScores[indicator.id].toFixed(3) : 'N/A'}
                                </p>
                            </div>
                        ))}
                    </div>
                    <div className="bg-white p-4 rounded-md shadow-md border border-green-300 text-center">
                        <h3 className="text-xl font-bold text-green-900 mb-2">Composite Distress Score (CDS):</h3>
                        <p className="text-4xl font-extrabold text-green-600">
                            {cdsScore !== null ? cdsScore.toFixed(3) : 'N/A'}
                        </p>
                        <p className="text-sm text-gray-600 mt-2">
                            (0 = Minimal Distress, 1 = Maximal Distress)
                        </p>
                    </div>
                </div>

                {/* Current Weights Section (new) */}
                {weightingMode === 'adaptive' && (
                    <div className="mb-8 p-4 sm:p-6 bg-orange-50 rounded-lg border border-orange-200">
                        <h2 className="text-2xl font-bold text-orange-800 mb-4">4. Current Weights</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {indicators.map(indicator => (
                                <div key={`current-weight-${indicator.id}`} className="bg-white p-3 rounded-md shadow-sm border border-gray-200">
                                    <p className="text-sm font-medium text-gray-700">{indicator.name}:</p>
                                    <p className="text-lg font-semibold text-orange-700">
                                        {weights[indicator.id] !== undefined ? (weights[indicator.id] * 100).toFixed(1) + '%' : 'N/A'}
                                    </p>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 text-sm text-gray-600">
                            <p>Weights are dynamically adjusted based on indicator values and normalized to ensure they sum to 100%.</p>
                        </div>
                    </div>
                )}

                {/* Interpretation Section */}
                <div className="p-4 sm:p-6 bg-purple-50 rounded-lg border border-purple-200">
                    <h2 className="text-2xl font-bold text-purple-800 mb-4">{weightingMode === 'equal' ? '4' : '5'}. Score Interpretation</h2>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-purple-500"></div>
                            <p className="ml-4 text-purple-700">Generating interpretation...</p>
                        </div>
                    ) : error ? (
                        <p className="text-red-600 text-center py-4">{error}</p>
                    ) : (
                        <div className="bg-white p-4 rounded-md shadow-md border border-purple-300">
                            <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{interpretation}</p>
                        </div>
                    )}
                </div>

                {/* Disclaimer */}
                <div className="mt-8 text-center text-gray-500 text-sm">
                    <p>This is a prototype for demonstration purposes and uses synthetic data.</p>
                    <p>It is not intended for real-world crisis tracking without further development and validation.</p>
                    <p className="mt-2">Based on the open framework by SynergyMetrics Initiative</p>
                </div>
            </div>
        </div>
    );
};

export default App;


