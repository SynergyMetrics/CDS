import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button.jsx';
import './App.css';

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
    // State to store the AI's interpretation of the CDS
    const [aiInterpretation, setAiInterpretation] = useState('');
    // State to manage the loading status of the AI interpretation
    const [isLoadingAI, setIsLoadingAI] = useState(false);
    // State to store any error messages
    const [error, setError] = useState('');

    // Define the indicators and their properties for easier rendering and calculation
    const indicators = [
        { id: 'hunger', name: 'Hunger (Caloric Intake)', unit: 'kcal/day', min: 0, max: 4000, placeholder: 'e.g., 2500' },
        { id: 'inequality', name: 'Inequality (Gini Index)', unit: '', min: 0, max: 100, placeholder: 'e.g., 40' },
        { id: 'conflict', name: 'Conflict Deaths', unit: 'per 100k', min: 0, max: 50, placeholder: 'e.g., 10' },
        { id: 'displacement', name: 'Displacement', unit: 'per 100k', min: 0, max: 1000, placeholder: 'e.g., 200' },
        { id: 'governance', name: 'Governance (Freedom House Score)', unit: '', min: 0, max: 100, placeholder: 'e.g., 50' },
        { id: 'suicide', name: 'Mental Health (Suicides)', unit: 'per 100k', min: 0, max: 30, placeholder: 'e.g., 5' },
    ];

    // Function to normalize an individual indicator's value based on its type
    const normalizeIndicator = (value, id) => {
        let score = 0;
        switch (id) {
            case 'hunger':
                // s_hunger(r,t) = 1 - (caloric intake per capita / 4000)
                score = 1 - (value / 4000);
                break;
            case 'inequality':
                // s_inequality(r,t) = Gini index / 100
                score = value / 100;
                break;
            case 'conflict':
                // s_conflict(r,t) = min(1, deaths per 100,000 / 50)
                score = Math.min(1, value / 50);
                break;
            case 'displacement':
                // s_displacement(r,t) = min(1, IDPs + refugees per 100,000 / 1000)
                score = Math.min(1, value / 1000);
                break;
            case 'governance':
                // s_governance(r,t) = 1 - (Freedom House Score / 100)
                score = 1 - (value / 100);
                break;
            case 'suicide':
                // s_suicide(r,t) = min(1, suicides per 100,000 / 30)
                score = Math.min(1, value / 30);
                break;
            default:
                score = 0;
        }
        // Ensure the score is within the [0, 1] range
        return Math.max(0, Math.min(1, score));
    };

    // Function to handle changes in the input fields
    const handleInputChange = (e) => {
        const { id, value } = e.target;
        setIndicatorValues(prev => ({
            ...prev,
            [id]: parseFloat(value) || 0 // Convert input value to a float, default to 0 if NaN
        }));
    };

    // Function to calculate the CDS and fetch AI interpretation
    const calculateAndInterpret = async () => {
        setError(''); // Clear previous errors
        setIsLoadingAI(true); // Set loading state for AI

        const currentNormalizedScores = {};
        let totalCds = 0;
        const numIndicators = indicators.length;
        const equalWeight = 1 / numIndicators; // Using equal weighting for this prototype

        // Normalize each indicator and sum them up for CDS calculation
        indicators.forEach(indicator => {
            const value = indicatorValues[indicator.id];
            const normalized = normalizeIndicator(value, indicator.id);
            currentNormalizedScores[indicator.id] = normalized;
            totalCds += normalized * equalWeight;
        });

        setNormalizedScores(currentNormalizedScores);
        setCdsScore(totalCds);

        // Prepare prompt for AI interpretation
        const prompt = `Interpret the following Composite Distress Score (CDS) which ranges from 0 (minimal distress) to 1 (maximal distress). 
                        The score is ${totalCds.toFixed(3)}. 
                        This score is derived from indicators like hunger, inequality, conflict, displacement, governance, and mental health.
                        Provide a concise interpretation of what this score signifies regarding human distress in a region.`;

        try {
            // For this prototype, we'll provide a simple interpretation based on score ranges
            let interpretation = '';
            if (totalCds < 0.2) {
                interpretation = `With a CDS of ${totalCds.toFixed(3)}, this region shows minimal distress levels. The indicators suggest relatively stable conditions with low conflict, adequate nutrition, reasonable governance, and manageable displacement. This represents a favorable situation for human wellbeing.`;
            } else if (totalCds < 0.4) {
                interpretation = `A CDS of ${totalCds.toFixed(3)} indicates low to moderate distress. While the situation is generally manageable, there may be emerging concerns in some indicators that warrant monitoring. Preventive measures could help maintain stability.`;
            } else if (totalCds < 0.6) {
                interpretation = `This CDS of ${totalCds.toFixed(3)} reflects moderate distress levels. The region is experiencing notable challenges across multiple indicators. This suggests the need for targeted interventions to address specific areas of concern before conditions worsen.`;
            } else if (totalCds < 0.8) {
                interpretation = `With a CDS of ${totalCds.toFixed(3)}, this region shows high distress levels. Multiple indicators are signaling serious challenges that require immediate attention. Humanitarian assistance and policy interventions are likely needed to prevent further deterioration.`;
            } else {
                interpretation = `A CDS of ${totalCds.toFixed(3)} indicates severe distress. This represents a crisis situation with multiple indicators showing critical levels. Urgent humanitarian intervention, international assistance, and comprehensive crisis response measures are essential.`;
            }
            
            setAiInterpretation(interpretation);
        } catch (err) {
            console.error("Error generating interpretation:", err);
            setError("Failed to generate interpretation. Please try again.");
            setAiInterpretation('');
        } finally {
            setIsLoadingAI(false); // End loading state
        }
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

                {/* Calculated Scores Section */}
                <div className="mb-8 p-4 sm:p-6 bg-green-50 rounded-lg border border-green-200">
                    <h2 className="text-2xl font-bold text-green-800 mb-4">2. Calculated Scores</h2>
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
                    <h2 className="text-2xl font-bold text-purple-800 mb-4">3. Score Interpretation</h2>
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
                </div>
            </div>
        </div>
    );
};

export default App;

