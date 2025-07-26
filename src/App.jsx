import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button.jsx';
import './App.css';

// Main App component for the Composite Distress Score (CDS) Framework Prototype
const App = () => {
    // State to store the input values for each indicator
    const [indicatorValues, setIndicatorValues] = useState({
        hunger: 2500, // Caloric intake per capita (0-4000 kcal/day)
        inequality: 40, // Gini index (0-100)
        conflict: '', // Deaths per 100,000
        displacement: '', // IDPs + refugees per 100,000
        governance: 50, // Freedom House Score (0-100)
        suicide: 5, // Suicides per 100,000
    });

    // Define the indicators and their properties for easier rendering and calculation
    const indicators = [
        { id: 'hunger', name: 'Hunger (Caloric Intake)', unit: 'kcal/day', min: 0, max: 4000, placeholder: 'e.g., 2500' },
        { id: 'inequality', name: 'Inequality (Gini Index)', unit: '', min: 0, max: 100, placeholder: 'e.g., 40' },
        { id: 'conflict', name: 'Conflict Deaths', unit: 'per 100k', min: 0, max: 100000, placeholder: 'e.g., 10' },
        { id: 'displacement', name: 'Displacement', unit: 'per 100k', min: 0, max: 100000, placeholder: 'e.g., 200' },
        { id: 'governance', name: 'Governance (Freedom House Score)', unit: '', min: 0, max: 100, placeholder: 'e.g., 50' },
        { id: 'suicide', name: 'Mental Health (Suicides)', unit: 'per 100k', min: 0, max: 100, placeholder: 'e.g., 5' },
    ];

    // Initialize weights equally for all indicators
    const initialWeights = {};
    indicators.forEach(indicator => {
        initialWeights[indicator.id] = 1 / indicators.length;
    });

    const [weights, setWeights] = useState(initialWeights);
    const [normalizedScores, setNormalizedScores] = useState({});
    const [cdsScore, setCdsScore] = useState(null);
    const [aiInterpretation, setAiInterpretation] = useState('');
    const [isLoadingAI, setIsLoadingAI] = useState(false);
    const [error, setError] = useState('');

    // Learning rate for dynamic weighting
    const eta = 0.01;

    // Softmax function to normalize weights into a probability distribution
    const softmax = (values) => {
        // Find the maximum value to prevent overflow
        const maxValue = Math.max(...values);
        
        // Subtract max value from each element and compute exponentials
        const exponentials = values.map(value => Math.exp(value - maxValue));
        
        // Calculate the sum of exponentials
        const sumExponentials = exponentials.reduce((sum, exp) => sum + exp, 0);
        
        // Normalize by dividing each exponential by the sum
        return exponentials.map(exp => exp / sumExponentials);
    };

    // Function to normalize an individual indicator's value based on its type
    const normalizeIndicator = (value, id) => {
        let score = 0;
        switch (id) {
            case 'hunger':
                score = 1 - (value / 4000);
                break;
            case 'inequality':
                score = value / 100;
                break;
            case 'conflict':
                score = Math.min(1, value / 100000);
                break;
            case 'displacement':
                score = Math.min(1, value / 100000);
                break;
            case 'governance':
                score = 1 - (value / 100);
                break;
            case 'suicide':
                score = Math.min(1, value / 100);
                break;
            default:
                score = 0;
        }
        return Math.max(0, Math.min(1, score));
    };

    // Function to handle changes in the input fields
    const handleInputChange = (e) => {
        const { id, value } = e.target;
        if (value === '' || /^(0|[1-9][0-9]*)$/.test(value)) {
            setIndicatorValues(prev => ({
                ...prev,
                [id]: value
            }));
        }
    };

    // Function to calculate the CDS and fetch AI interpretation
    const calculateAndInterpret = async () => {
        setError('');
        setIsLoadingAI(true);

        const currentNormalizedScores = {};
        let sumWeightedScores = 0;
        const rawWeights = []; // Array to store raw weight values for softmax
        const weightKeys = []; // Array to maintain order of indicators

        // Step 1: Calculate normalized scores and raw weights
        indicators.forEach(indicator => {
            const value = indicatorValues[indicator.id] === '' ? 0 : Number(indicatorValues[indicator.id]);
            const normalized = normalizeIndicator(value, indicator.id);
            currentNormalizedScores[indicator.id] = normalized;

            // Calculate raw weight for this indicator using gradient-based update
            const currentWeight = weights[indicator.id];
            const rawWeight = currentWeight + eta * normalized;
            
            rawWeights.push(rawWeight);
            weightKeys.push(indicator.id);
        });

        // Step 2: Apply softmax to normalize weights into a probability distribution
        const softmaxWeights = softmax(rawWeights);
        const newWeights = {};
        
        // Step 3: Map softmax weights back to indicators and calculate weighted sum
        weightKeys.forEach((key, index) => {
            newWeights[key] = softmaxWeights[index];
            sumWeightedScores += currentNormalizedScores[key] * softmaxWeights[index];
        });

        setNormalizedScores(currentNormalizedScores);
        setWeights(newWeights); // Update weights state with softmax-normalized values
        setCdsScore(sumWeightedScores);

        // Interpretation logic remains the same
        let interpretation = '';
        if (sumWeightedScores < 0.2) {
            interpretation = `With a CDS of ${sumWeightedScores.toFixed(3)}, this region shows minimal distress levels. The indicators suggest relatively stable conditions with low conflict, adequate nutrition, reasonable governance, and manageable displacement. This represents a favorable situation for human wellbeing.`;
        } else if (sumWeightedScores < 0.4) {
            interpretation = `A CDS of ${sumWeightedScores.toFixed(3)} indicates low to moderate distress. While the situation is generally manageable, there may be emerging concerns in some indicators that warrant monitoring. Preventive measures could help maintain stability.`;
        } else if (sumWeightedScores < 0.6) {
            interpretation = `This CDS of ${sumWeightedScores.toFixed(3)} reflects moderate distress levels. The region is experiencing notable challenges across multiple indicators. This suggests the need for targeted interventions to address specific areas of concern before conditions worsen.`;
        } else if (sumWeightedScores < 0.8) {
            interpretation = `With a CDS of ${sumWeightedScores.toFixed(3)}, this region shows high distress levels. Multiple indicators are signaling serious challenges that require immediate attention. Humanitarian assistance and policy interventions are likely needed to prevent further deterioration.`;
        } else {
            interpretation = `A CDS of ${sumWeightedScores.toFixed(3)} indicates severe distress. This represents a crisis situation with multiple indicators showing critical levels. Urgent humanitarian intervention, international assistance, and comprehensive crisis response measures are essential.`;
        }
        setAiInterpretation(interpretation);
        setIsLoadingAI(false);
    };

    // Automatically calculate CDS and interpret on initial load and when indicator values change
    useEffect(() => {
        calculateAndInterpret();
    }, [indicatorValues]); // Recalculate when input values change

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 sm:p-6 md:p-8 font-sans">
            <div className="bg-white p-6 sm:p-8 md:p-10 rounded-xl shadow-2xl w-full max-w-4xl border border-gray-200">
                <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-gray-800 mb-6 sm:mb-8">
                    Composite Distress Score (CDS) Prototype
                </h1>
                <p className="text-center text-gray-600 mb-8 leading-relaxed">
                    This interactive prototype demonstrates the calculation of the Composite Distress Score (CDS)
                    based on synthetic indicator values. It provides an interpretation of the score to help understand regional distress levels.
                    <br />
                    <span className="text-sm font-medium text-blue-600">Now featuring softmax-normalized dynamic weighting for improved probability distribution.</span>
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
                    <Button
                        onClick={calculateAndInterpret}
                        className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
                    >
                        Calculate CDS & Get Interpretation
                    </Button>
                </div>

                {/* Weights Display Section */}
                <div className="mb-8 p-4 sm:p-6 bg-yellow-50 rounded-lg border border-yellow-200">
                    <h2 className="text-2xl font-bold text-yellow-800 mb-4">2. Dynamic Weights (Softmax Normalized)</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {indicators.map(indicator => (
                            <div key={`weight-${indicator.id}`} className="bg-white p-3 rounded-md shadow-sm border border-gray-200">
                                <p className="text-sm font-medium text-gray-700">{indicator.name}:</p>
                                <p className="text-lg font-semibold text-yellow-700">
                                    {weights[indicator.id] !== undefined ? (weights[indicator.id] * 100).toFixed(1) + '%' : 'N/A'}
                                </p>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 text-sm text-gray-600">
                        <p>Weights are dynamically adjusted based on indicator values and normalized using softmax to ensure they sum to 100%.</p>
                    </div>
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

                {/* AI Interpretation Section */}
                <div className="p-4 sm:p-6 bg-purple-50 rounded-lg border border-purple-200">
                    <h2 className="text-2xl font-bold text-purple-800 mb-4">4. Score Interpretation</h2>
                    {isLoadingAI ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-purple-500"></div>
                            <p className="ml-4 text-purple-700">Generating interpretation...</p>
                        </div>
                    ) : error ? (
                        <p className="text-red-600 text-center py-4">{error}</p>
                    ) : (
                        <div className="bg-white p-4 rounded-md shadow-md border border-purple-300">
                            <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{aiInterpretation}</p>
                        </div>
                    )}
                </div>

                {/* Disclaimer */}
                <div className="mt-8 text-center text-gray-500 text-sm">
                    <p>This is a prototype for demonstration purposes and uses synthetic data.</p>
                    <p>It is not intended for real-world crisis tracking without further development and validation.</p>
                    <p className="mt-2">Based on the open framework by SynergyMetrics Initiative</p>
                    <p className="mt-1 text-blue-600 font-medium">Enhanced with softmax normalization for dynamic weight distribution</p>
                </div>
            </div>
        </div>
    );
};

export default App;

