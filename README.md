# Cosmos DB Semantic Rerank — Node.js Sample

A TypeScript sample that demonstrates how to use the **Semantic Rerank** feature from the `@azure/cosmos` SDK. It runs a full-text search query against Azure Cosmos DB, then reranks the results using the Cosmos DB Inference Service so the most semantically relevant documents surface first.

## What this sample does

1. Connects to an Azure Cosmos DB account using Azure AD authentication
2. Upserts sample fitness product documents into a container
3. Runs a **Full-Text Search** (FTS) query using `FullTextContains` and `FullTextScore`
4. Sends the FTS results to the **Semantic Reranker** — an AI-powered service that scores each document by relevance to a natural language query
5. Prints the reranked results with scores
6. Cleans up the inserted documents

## Prerequisites

- **Node.js** 18 or later
- An **Azure Cosmos DB** account with:
  - A database and container (partitioned by `/category`) with a **full-text search** indexing policy on the `/description` path
  - An **inference endpoint** registered for the account (e.g. `https://{account}.{region}.dbinference.azure.com`)
- **Azure AD credentials** with the `Cosmos DB Built-in Data Contributor` role on the account
- The `@azure/cosmos` SDK package built from the `feature/cosmos-semantic-rerank` branch (or a version that includes the semantic rerank feature)

## Setup

1. **Clone this repo**

   ```bash
   git clone https://github.com/aditishree1/cosmos-semantic-rerank-node-sample.git
   cd cosmos-semantic-rerank-node-sample
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Update the configuration** in `src/index.ts`:

   ```typescript
   const ACCOUNT_ENDPOINT = "https://your-account.documents.azure.com:443/";
   const DATABASE_NAME = "your-database";
   const CONTAINER_NAME = "your-container";
   ```

4. **Set the inference endpoint environment variable**:

   ```bash
   # Windows
   set AZURE_COSMOS_SEMANTIC_RERANKER_INFERENCE_ENDPOINT=https://your-account.region.dbinference.azure.com

   # Linux/Mac
   export AZURE_COSMOS_SEMANTIC_RERANKER_INFERENCE_ENDPOINT=https://your-account.region.dbinference.azure.com
   ```

5. **(Optional)** If your Cosmos DB account is in a non-default Azure AD tenant, set:

   ```bash
   # Windows
   set AZURE_TENANT_ID=your-tenant-id

   # Linux/Mac
   export AZURE_TENANT_ID=your-tenant-id
   ```

## Run

```bash
npm start
```

This compiles the TypeScript and runs the demo. You should see output like:

```
=== Cosmos DB Semantic Rerank Demo ===

Upserting sample documents...
  ✓ Upserted 5 items

Waiting 10s for FTS index propagation...
Running FTS query: FullTextContains(c.description, 'gym') OR 'pulley'...
  ✓ FTS returned 2 results:
    - [sr-5] BudgetFlex Home Gym
    - [sr-2] FlexForce Cable Machine

Reranking 2 documents...
  Query: "most economical with multiple pulley adjustments ideal for home gyms"

=== Rerank Results ===
  Scores: 2
  Latency: {"data_preprocess_time":0.001,"inference_time":0.016,"postprocess_time":0.00001}
  Token usage: {"total_tokens":155}

  #0 (score: 0.9985) — BudgetFlex Home Gym
  #1 (score: 0.8730) — FlexForce Cable Machine

✅ Demo complete!
```

## How semantic rerank works

The Cosmos DB Inference Service uses an AI model to score documents against a natural language query. Unlike keyword-based search (which matches exact words), semantic reranking understands meaning — so a query like *"affordable home gym with pull-up bar"* correctly ranks a document about *"most economical home gym system"* at the top, even though the exact word "affordable" doesn't appear.

The key API call is:

```typescript
const result = await container.semanticRerank(
  "affordable home gym with pull-up bar",  // natural language query
  documents,                                // array of document strings
  { returnDocuments: true, topK: 5 },       // options
);
```

The result contains:
- **`rerankScores`** — array of `{ index, score, document }` sorted by relevance
- **`latency`** — server-side timing breakdown
- **`tokenUsage`** — AI tokens consumed

## Project structure

```
├── src/
│   └── index.ts          ← main demo script
├── package.json
├── tsconfig.json
└── README.md
```

## License

MIT
