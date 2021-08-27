import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BaseEntity,
  ManyToOne,
} from "typeorm"
import { Field, Int, ObjectType } from "type-graphql"
import { User } from "./user.entity"

@ObjectType()
@Entity()
export class Post extends BaseEntity {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  _id!: number

  @Field(() => String)
  @Column()
  title!: string

  @Field()
  @Column()
  text!: string

  @Field()
  @Column({ type: "int", default: 0 })
  points!: number

  @Field()
  @Column()
  creatorId: number

  @ManyToOne(() => User, (user) => user.posts)
  creator: number

  @Field(() => String)
  @CreateDateColumn()
  createdAt: Date = new Date()

  @Field(() => String)
  @UpdateDateColumn()
  updatedAt: Date = new Date()
}
