import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateDocumentAskHistoryTable1764000000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'document_ask_history',
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
            name: 'question',
            type: 'text',
          },
          {
            name: 'answer',
            type: 'text',
          },
          {
            name: 'sources',
            type: 'jsonb',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    const askHistoryTable = await queryRunner.getTable('document_ask_history');
    const missingForeignKeys: TableForeignKey[] = [];

    if (
      !askHistoryTable?.foreignKeys.some((foreignKey) =>
        foreignKey.columnNames.includes('user_id'),
      )
    ) {
      missingForeignKeys.push(
        new TableForeignKey({
          columnNames: ['user_id'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
    }

    if (
      !askHistoryTable?.foreignKeys.some((foreignKey) =>
        foreignKey.columnNames.includes('document_id'),
      )
    ) {
      missingForeignKeys.push(
        new TableForeignKey({
          columnNames: ['document_id'],
          referencedTableName: 'document',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
    }

    if (missingForeignKeys.length > 0) {
      await queryRunner.createForeignKeys(
        'document_ask_history',
        missingForeignKeys,
      );
    }

    await queryRunner.createIndex(
      'document_ask_history',
      new TableIndex({
        name: 'IDX_document_ask_history_user_document_created',
        columnNames: ['user_id', 'document_id', 'created_at'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const askHistoryTable = await queryRunner.getTable('document_ask_history');
    const historyIndex = askHistoryTable?.indices.find(
      (index) =>
        index.name === 'IDX_document_ask_history_user_document_created',
    );

    if (historyIndex) {
      await queryRunner.dropIndex('document_ask_history', historyIndex);
    }

    await queryRunner.dropTable('document_ask_history');
  }
}
