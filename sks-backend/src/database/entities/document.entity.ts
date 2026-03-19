import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'vector',
    width: 768,
    nullable: true,
  })
  embedding: number[];
}
