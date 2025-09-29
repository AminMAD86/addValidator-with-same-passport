const { ethers } = require('ethers');

// Configuration
const RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com';
const CONTRACT_ADDRESS = '0x3743c7Bf782260824f62e759677d7C63FfE42c52';

// Contract ABI for addValidator function
const CONTRACT_ABI = [
    {
        "inputs": [
            {"internalType": "address", "name": "_attester", "type": "address"},
            {"internalType": "bytes32[]", "name": "_merkleProof", "type": "bytes32[]"},
            {
                "components": [
                    {"internalType": "bytes32", "name": "vkeyHash", "type": "bytes32"},
                    {"internalType": "bytes", "name": "proof", "type": "bytes"},
                    {"internalType": "bytes32[]", "name": "publicInputs", "type": "bytes32[]"},
                    {"internalType": "bytes", "name": "committedInputs", "type": "bytes"},
                    {"internalType": "uint256[]", "name": "committedInputCounts", "type": "uint256[]"},
                    {"internalType": "uint256", "name": "validityPeriodInSeconds", "type": "uint256"},
                    {"internalType": "string", "name": "domain", "type": "string"},
                    {"internalType": "string", "name": "scope", "type": "string"},
                    {"internalType": "bool", "name": "devMode", "type": "bool"}
                ],
                "internalType": "struct ProofVerificationParams",
                "name": "_params",
                "type": "tuple"
            },
            {
                "components": [
                    {"internalType": "uint256", "name": "x", "type": "uint256"},
                    {"internalType": "uint256", "name": "y", "type": "uint256"}
                ],
                "internalType": "struct G1Point",
                "name": "_publicKeyG1",
                "type": "tuple"
            },
            {
                "components": [
                    {"internalType": "uint256", "name": "x0", "type": "uint256"},
                    {"internalType": "uint256", "name": "x1", "type": "uint256"},
                    {"internalType": "uint256", "name": "y0", "type": "uint256"},
                    {"internalType": "uint256", "name": "y1", "type": "uint256"}
                ],
                "internalType": "struct G2Point",
                "name": "_publicKeyG2",
                "type": "tuple"
            },
            {
                "components": [
                    {"internalType": "uint256", "name": "x", "type": "uint256"},
                    {"internalType": "uint256", "name": "y", "type": "uint256"}
                ],
                "internalType": "struct G1Point",
                "name": "_signature",
                "type": "tuple"
            }
        ],
        "name": "addValidator",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

// Helper function to get user input
function getUserInput(prompt) {
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    return new Promise((resolve) => {
        rl.question(prompt, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

// Function to parse args data from console logs
function parseArgsData(argsInput) {
    console.log('🔧 Parsing args data from console logs...');
    
    try {
        // Remove the "args:" prefix and any extra spaces
        let cleanInput = argsInput.replace(/^args:\s*/, '').trim();
        
        // Check if it's already a JSON array
        if (cleanInput.startsWith('[') && cleanInput.endsWith(']')) {
            console.log('   ✅ Input is already a JSON array');
            return JSON.parse(cleanInput);
        }
        
        // Try to parse as tuple format
        if (cleanInput.startsWith('(') && cleanInput.endsWith(')')) {
            console.log('   🔧 Converting tuple format to array...');
            
            // Remove parentheses
            cleanInput = cleanInput.slice(1, -1);
            
            // Split by commas, but be careful with nested structures
            const parts = [];
            let current = '';
            let depth = 0;
            let inString = false;
            let stringChar = '';
            let braceDepth = 0;
            
            for (let i = 0; i < cleanInput.length; i++) {
                const char = cleanInput[i];
                
                if (!inString && (char === '"' || char === "'")) {
                    inString = true;
                    stringChar = char;
                    current += char;
                } else if (inString && char === stringChar) {
                    inString = false;
                    stringChar = '';
                    current += char;
                } else if (!inString && char === '{') {
                    braceDepth++;
                    current += char;
                } else if (!inString && char === '}') {
                    braceDepth--;
                    current += char;
                } else if (!inString && char === '(') {
                    depth++;
                    current += char;
                } else if (!inString && char === ')') {
                    depth--;
                    current += char;
                } else if (!inString && char === ',' && depth === 0 && braceDepth === 0) {
                    parts.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            
            if (current.trim()) {
                parts.push(current.trim());
            }
            
            // Parse each part to convert strings to proper types
            const parsedParts = parts.map(part => {
                part = part.trim();
                
                // Try to parse as JSON object
                if (part.startsWith('{') && part.endsWith('}')) {
                    try {
                        return JSON.parse(part);
                    } catch (e) {
                        console.log(`   ⚠️ Could not parse object: ${part.substring(0, 50)}...`);
                        return part;
                    }
                }
                
                // Try to parse as array
                if (part.startsWith('[') && part.endsWith(']')) {
                    try {
                        return JSON.parse(part);
                    } catch (e) {
                        console.log(`   ⚠️ Could not parse array: ${part.substring(0, 50)}...`);
                        return part;
                    }
                }
                
                // Try to parse as number
                if (!isNaN(part) && part !== '') {
                    return part;
                }
                
                // Return as string
                return part;
            });
            
            console.log(`   ✅ Converted tuple to array with ${parsedParts.length} parts`);
            console.log(`   Part types: ${parsedParts.map((p, i) => `${i}:${typeof p}`).join(', ')}`);
            return parsedParts;
        }
        
        throw new Error('Invalid input format');
        
    } catch (error) {
        console.log(`   ❌ Error parsing args data: ${error.message}`);
        throw error;
    }
}

// Function to extract data from parsed args
function extractDataFromArgs(args) {
    console.log('🔍 Extracting data from parsed args...');
    
    try {
        // Extract attester address (first element)
        const attester = args[0];
        console.log(`   Attester: ${attester}`);
        
        // Extract merkle proof (second element - should be empty array)
        const merkleProof = args[1] || [];
        console.log(`   Merkle Proof: ${merkleProof.length} items`);
        
        // Extract ZKPassport data (third element) - this should be an object
        let zkPassportData = args[2];
        
        console.log(`   Raw ZKPassport data type: ${typeof zkPassportData}`);
        console.log(`   Raw ZKPassport data: ${JSON.stringify(zkPassportData).substring(0, 100)}...`);
        
        // Handle case where zkPassportData might be a string that needs parsing
        if (typeof zkPassportData === 'string') {
            try {
                zkPassportData = JSON.parse(zkPassportData);
                console.log(`   ✅ Parsed ZKPassport data from string`);
            } catch (e) {
                console.log(`   ⚠️ Could not parse ZKPassport data as JSON: ${e.message}`);
            }
        }
        
        // Ensure zkPassportData is an object with the required structure
        if (!zkPassportData || typeof zkPassportData !== 'object') {
            console.log(`   ❌ ZKPassport data is not a valid object. Type: ${typeof zkPassportData}, Value: ${JSON.stringify(zkPassportData)}`);
            throw new Error('ZKPassport data is not a valid object');
        }
        
        console.log(`   ZKPassport publicInputs: ${zkPassportData.publicInputs?.length || 0} items`);
        
        // Extract BLS keys (fourth, fifth, sixth elements)
        const publicKeyG1 = args[3];
        const publicKeyG2 = args[4];
        const signature = args[5];
        
        console.log(`   BLS Keys: ${publicKeyG1 && publicKeyG2 && signature ? 'Present' : 'Missing'}`);
        
        return {
            attester,
            merkleProof,
            zkPassportData,
            publicKeyG1,
            publicKeyG2,
            signature
        };
        
    } catch (error) {
        console.log(`   ❌ Error extracting data: ${error.message}`);
        throw error;
    }
}

// Function to call addValidator
async function callAddValidator(wallet, extractedData) {
    console.log('🚀 Calling addValidator function...');
    
    try {
        // Create provider and contract
        let provider;
        try {
            // Try ethers v6 syntax first
            provider = new ethers.JsonRpcProvider(RPC_URL);
        } catch (error) {
            // Fallback to ethers v5 syntax
            provider = new ethers.providers.JsonRpcProvider(RPC_URL);
        }
        
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet.connect(provider));
        
        // Display transaction parameters
        console.log('📋 Transaction parameters:');
        console.log(`   Attester: ${extractedData.attester}`);
        console.log(`   Merkle Proof: ${extractedData.merkleProof.length} items`);
        console.log(`   ZKPassport: Using original data (unmodified)`);
        console.log(`   BLS Keys: From provided data`);
        
        // Estimate gas
        console.log('⛽ Estimating gas...');
        let gasEstimate;
        try {
            gasEstimate = await contract.addValidator.estimateGas(
                extractedData.attester,
                extractedData.merkleProof,
                extractedData.zkPassportData,
                extractedData.publicKeyG1,
                extractedData.publicKeyG2,
                extractedData.signature
            );
            console.log(`   Gas estimate: ${gasEstimate.toString()}`);
        } catch (error) {
            console.log(`   ⚠️ Gas estimation failed: ${error.message}`);
            console.log(`   Using manual gas limit: 2,000,000`);
            gasEstimate = ethers.BigNumber.from('2000000');
        }
        
        // Send transaction
        console.log('📤 Sending transaction...');
        const tx = await contract.addValidator(
            extractedData.attester,
            extractedData.merkleProof,
            extractedData.zkPassportData,
            extractedData.publicKeyG1,
            extractedData.publicKeyG2,
            extractedData.signature,
            {
                gasLimit: gasEstimate.mul(120).div(100) // Add 20% buffer
            }
        );
        
        console.log(`   Transaction hash: ${tx.hash}`);
        console.log('⏳ Waiting for confirmation...');
        
        const receipt = await tx.wait();
        console.log(`✅ Transaction confirmed! Block: ${receipt.blockNumber}`);
        console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
        
        return receipt;
        
    } catch (error) {
        console.log(`❌ Error calling addValidator: ${error.message}`);
        throw error;
    }
}

// Main function
async function main() {
    console.log('🎯 Validator Re-join Script for Non-Restricted Users');
    console.log('=' .repeat(60));
    console.log('');
    console.log('📋 Instructions:');
    console.log('1. Open the official website and scan the QR code with ZKPassport app');
    console.log('2. Click the "Register" button');
    console.log('3. Open browser console (F12) and copy the "args:" data from the error');
    console.log('4. Paste the args data when prompted below');
    console.log('');
    
    try {
        // Get wallet details
        const privateKey = await getUserInput('Enter your private key: ');
        if (!privateKey) {
            console.log('❌ No private key provided. Exiting...');
            return;
        }
        
        // Create wallet
        let wallet;
        try {
            // Try ethers v6 syntax first
            wallet = new ethers.Wallet(privateKey);
        } catch (error) {
            // Fallback to ethers v5 syntax
            wallet = new ethers.Wallet(privateKey);
        }
        
        console.log(`✅ Wallet created: ${wallet.address}`);
        
        // Get args data
        console.log('');
        console.log('📋 Paste the args data from console logs:');
        console.log('   (Include the "args:" prefix and all the data)');
        console.log('   Press Enter when done pasting...');
        
        const argsInput = await getUserInput('');
        
        if (!argsInput) {
            console.log('❌ No args data provided. Exiting...');
            return;
        }
        
        // Parse and extract data
        const args = parseArgsData(argsInput);
        const extractedData = extractDataFromArgs(args);
        
        console.log('');
        console.log('✅ Data extracted from console logs');
        console.log(`   Attester: ${extractedData.attester}`);
        console.log(`   Merkle Proof: ${extractedData.merkleProof.length} items`);
        console.log(`   ZKPassport publicInputs: ${extractedData.zkPassportData.publicInputs?.length || 0} items`);
        console.log(`   BLS Keys: Present`);
        
        // Verify wallet address matches
        if (wallet.address.toLowerCase() !== extractedData.attester.toLowerCase()) {
            console.log('');
            console.log('⚠️ WARNING: Wallet address mismatch!');
            console.log(`   Private key wallet: ${wallet.address}`);
            console.log(`   Args attester: ${extractedData.attester}`);
            console.log('   Make sure you are using the correct private key for this attester address.');
            
            const proceed = await getUserInput('Do you want to continue anyway? (y/N): ');
            if (proceed.toLowerCase() !== 'y') {
                console.log('❌ Operation cancelled.');
                return;
            }
        }
        
        // Call addValidator
        console.log('');
        const receipt = await callAddValidator(wallet, extractedData);
        
        console.log('');
        console.log('🎉 SUCCESS! Validator re-joined successfully!');
        console.log(`   Transaction: https://sepolia.etherscan.io/tx/${receipt.transactionHash}`);
        console.log(`   Block: ${receipt.blockNumber}`);
        
    } catch (error) {
        console.log('');
        console.log('❌ Failed to re-join validator set');
        console.log(`   Error: ${error.message}`);
        console.log('');
        console.log('💡 Troubleshooting:');
        console.log('   - Make sure you are from a non-restricted country');
        console.log('   - Verify the args data was copied correctly');
        console.log('   - Check that your wallet has enough ETH for gas');
        console.log('   - Ensure you are using the correct private key');
    }
}

// Run the script
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    parseArgsData,
    extractDataFromArgs,
    callAddValidator
};
