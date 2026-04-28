import { ObjectId } from "mongodb";

export interface Prompt {
  _id?: ObjectId;
  name: string;
  description: string;
  content: string;
  createdAt?: Date;
  updatedAt?: Date;
}
