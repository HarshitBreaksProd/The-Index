import { pipeline } from "@xenova/transformers";
import type {
  PipelineType,
  FeatureExtractionPipeline,
} from "@xenova/transformers";

class EmbeddingPipeline {
  static task: PipelineType = "feature-extraction";
  static model = "Xenova/all-MiniLM-L6-v2";
  static instance: FeatureExtractionPipeline | null = null;

  static async getInstance(progress_callback?: Function) {
    if (this.instance === null) {
      console.log("Loading embedding model for the first time...");
      this.instance = (await pipeline(this.task, this.model, {
        progress_callback,
      })) as FeatureExtractionPipeline;
      console.log("Embedding model loaded successfully");
    }

    return this.instance;
  }
}

export default EmbeddingPipeline;
