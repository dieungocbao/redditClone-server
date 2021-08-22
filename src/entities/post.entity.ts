import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BaseEntity
} from "typeorm"
import { Field, Int, ObjectType } from "type-graphql"

@ObjectType()
@Entity()
export class Post extends BaseEntity{
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  _id!: number

  @Field(() => String)
  @CreateDateColumn()
  createdAt: Date = new Date()

  @Field(() => String)
  @UpdateDateColumn()
  updatedAt: Date = new Date()

  @Field(() => String)
  @Column()
  title!: string
}
