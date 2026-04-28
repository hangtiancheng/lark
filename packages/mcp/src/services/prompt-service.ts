import { Collection, ObjectId, Db } from "mongodb";
import { type Prompt } from "../types.js";

export class PromptService {
  private collection: Collection<Prompt>;

  constructor(db: Db) {
    this.collection = db.collection<Prompt>("prompts");
  }

  async create(
    prompt: Omit<Prompt, "_id" | "createdAt" | "updatedAt">,
  ): Promise<Prompt> {
    const now = new Date();
    const newPrompt: Prompt = {
      ...prompt,
      createdAt: now,
      updatedAt: now,
    };
    const result = await this.collection.insertOne(newPrompt);
    return { ...newPrompt, _id: result.insertedId };
  }

  async findAll(): Promise<Prompt[]> {
    return this.collection.find().toArray();
  }

  async findById(id: string): Promise<Prompt | null> {
    if (!ObjectId.isValid(id)) return null;
    return this.collection.findOne({ _id: new ObjectId(id) });
  }

  async findByName(name: string): Promise<Prompt | null> {
    return this.collection.findOne({ name: { $regex: name, $options: "i" } });
  }

  async update(
    id: string,
    update: Partial<Omit<Prompt, "_id" | "createdAt" | "updatedAt">>,
  ): Promise<Prompt | null> {
    if (!ObjectId.isValid(id)) return null;
    const result = await this.collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { ...update, updatedAt: new Date() } },
      { returnDocument: "after" },
    );
    return result;
  }

  async delete(id: string): Promise<boolean> {
    if (!ObjectId.isValid(id)) return false;
    const result = await this.collection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount === 1;
  }
}
