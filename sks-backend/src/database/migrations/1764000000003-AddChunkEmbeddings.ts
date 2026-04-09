import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddChunkEmbeddings1764000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector;`);

    await queryRunner.addColumns('chunks', [
      new TableColumn({
        name: 'embedding',
        type: 'vector',
        length: '3072',
        isNullable: true,
      }),
      new TableColumn({
        name: 'embedding_model',
        type: 'text',
        isNullable: true,
      }),
      new TableColumn({
        name: 'page_number',
        type: 'int',
        isNullable: true,
      }),
      new TableColumn({
        name: 'section_title',
        type: 'text',
        isNullable: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('chunks', 'section_title');
    await queryRunner.dropColumn('chunks', 'page_number');
    await queryRunner.dropColumn('chunks', 'embedding_model');
    await queryRunner.dropColumn('chunks', 'embedding');
  }
}
