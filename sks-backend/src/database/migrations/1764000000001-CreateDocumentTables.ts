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

    const documentTable = await queryRunner.getTable('document');
    const hasDocumentContentHashIndex =
      documentTable?.indices.some(
        (index) => index.name === 'IDX_document_content_hash',
      ) ?? false;

    if (!hasDocumentContentHashIndex) {
      await queryRunner.createIndex(
        'document',
        new TableIndex({
          name: 'IDX_document_content_hash',
          columnNames: ['content_hash'],
        }),
      );
    }

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

    const userDocumentsTable = await queryRunner.getTable('user_documents');
    const missingUserDocumentForeignKeys: TableForeignKey[] = [];

    if (
      !userDocumentsTable?.foreignKeys.some((foreignKey) =>
        foreignKey.columnNames.includes('user_id'),
      )
    ) {
      missingUserDocumentForeignKeys.push(
        new TableForeignKey({
          columnNames: ['user_id'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
    }

    if (
      !userDocumentsTable?.foreignKeys.some((foreignKey) =>
        foreignKey.columnNames.includes('document_id'),
      )
    ) {
      missingUserDocumentForeignKeys.push(
        new TableForeignKey({
          columnNames: ['document_id'],
          referencedTableName: 'document',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
    }

    if (missingUserDocumentForeignKeys.length > 0) {
      await queryRunner.createForeignKeys(
        'user_documents',
        missingUserDocumentForeignKeys,
      );
    }

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

    const documentChunksTable = await queryRunner.getTable('document_chunks');
    const missingDocumentChunkForeignKeys: TableForeignKey[] = [];

    if (
      !documentChunksTable?.foreignKeys.some((foreignKey) =>
        foreignKey.columnNames.includes('document_id'),
      )
    ) {
      missingDocumentChunkForeignKeys.push(
        new TableForeignKey({
          columnNames: ['document_id'],
          referencedTableName: 'document',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
    }

    if (
      !documentChunksTable?.foreignKeys.some((foreignKey) =>
        foreignKey.columnNames.includes('chunk_id'),
      )
    ) {
      missingDocumentChunkForeignKeys.push(
        new TableForeignKey({
          columnNames: ['chunk_id'],
          referencedTableName: 'chunks',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
    }

    if (missingDocumentChunkForeignKeys.length > 0) {
      await queryRunner.createForeignKeys(
        'document_chunks',
        missingDocumentChunkForeignKeys,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('document_chunks');
    await queryRunner.dropTable('user_documents');
    await queryRunner.dropIndex('document', 'IDX_document_content_hash');
    await queryRunner.dropTable('chunks');
    await queryRunner.dropTable('document');
  }
}
