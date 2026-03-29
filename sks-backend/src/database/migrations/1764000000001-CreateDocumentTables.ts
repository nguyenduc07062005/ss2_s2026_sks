import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateDocumentTables1764000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

    await queryRunner.createTable(
      new Table({
        name: 'document',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'title',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'doc_date',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'extra_attributes',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'file_ref',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'file_size',
            type: 'bigint',
            isNullable: true,
          },
          {
            name: 'content_hash',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'text',
            default: "'pending'",
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'document',
      new TableIndex({
        name: 'IDX_document_content_hash',
        columnNames: ['content_hash'],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'chunks',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'chunk_index',
            type: 'int',
          },
          {
            name: 'chunk_text',
            type: 'text',
          },
          {
            name: 'token_count',
            type: 'int',
          },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'user_documents',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'user_id',
            type: 'uuid',
          },
          {
            name: 'document_id',
            type: 'uuid',
          },
          {
            name: 'document_name',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'is_favorite',
            type: 'boolean',
            default: 'false',
          },
        ],
        uniques: [
          {
            name: 'UQ_user_documents_user_document',
            columnNames: ['user_id', 'document_id'],
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKeys('user_documents', [
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        columnNames: ['document_id'],
        referencedTableName: 'document',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    ]);

    await queryRunner.createTable(
      new Table({
        name: 'document_chunks',
        columns: [
          {
            name: 'document_id',
            type: 'uuid',
            isPrimary: true,
          },
          {
            name: 'chunk_id',
            type: 'uuid',
            isPrimary: true,
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKeys('document_chunks', [
      new TableForeignKey({
        columnNames: ['document_id'],
        referencedTableName: 'document',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        columnNames: ['chunk_id'],
        referencedTableName: 'chunks',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('document_chunks');
    await queryRunner.dropTable('user_documents');
    await queryRunner.dropIndex('document', 'IDX_document_content_hash');
    await queryRunner.dropTable('chunks');
    await queryRunner.dropTable('document');
  }
}
