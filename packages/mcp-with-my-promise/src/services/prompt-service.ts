import { Collection, ObjectId, Db } from "mongodb";
import { type Prompt } from "../types.js";
import MyPromise from "@lark/promises-a-plus";

export class PromptService {
  private collection: Collection<Prompt>;

  constructor(db: Db) {
    this.collection = db.collection<Prompt>("prompts");
  }

  create(
    prompt: Omit<Prompt, "_id" | "createdAt" | "updatedAt">,
  ): MyPromise<Prompt> {
    const now = new Date();
    const newPrompt: Prompt = {
      ...prompt,
      createdAt: now,
      updatedAt: now,
    };
    return new MyPromise((resolve, reject) => {
      this.collection
        .insertOne(newPrompt)
        .then(
          (result) => resolve({ ...newPrompt, _id: result.insertedId }),
          reject,
        );
    });
  }

  findAll(): MyPromise<Prompt[]> {
    return new MyPromise((resolve, reject) => {
      this.collection.find().toArray().then(resolve, reject);
    });
  }

  findById(id: string): MyPromise<Prompt | null> {
    if (!ObjectId.isValid(id)) return MyPromise.resolve(null);
    return new MyPromise((resolve, reject) => {
      this.collection.findOne({ _id: new ObjectId(id) }).then(resolve, reject);
    });
  }

  findByName(name: string): MyPromise<Prompt | null> {
    return new MyPromise((resolve, reject) => {
      this.collection
        .findOne({ name: { $regex: name, $options: "i" } })
        .then(resolve, reject);
    });
  }

  update(
    id: string,
    update: Partial<Omit<Prompt, "_id" | "createdAt" | "updatedAt">>,
  ): MyPromise<Prompt | null> {
    if (!ObjectId.isValid(id)) return MyPromise.resolve(null);
    return new MyPromise((resolve, reject) => {
      this.collection
        .findOneAndUpdate(
          { _id: new ObjectId(id) },
          { $set: { ...update, updatedAt: new Date() } },
          { returnDocument: "after" },
        )
        .then(resolve, reject);
    });
  }

  delete(id: string): MyPromise<boolean> {
    if (!ObjectId.isValid(id)) return MyPromise.resolve(false);
    return new MyPromise((resolve, reject) => {
      this.collection
        .deleteOne({ _id: new ObjectId(id) })
        .then((result) => resolve(result.deletedCount === 1), reject);
    });
  }
}
