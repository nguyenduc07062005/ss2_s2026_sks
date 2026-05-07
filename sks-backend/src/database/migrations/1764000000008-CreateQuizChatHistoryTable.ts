import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateQuizChatHistoryTable1764000000008 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'quiz_chat_history',
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
            name: 'document_ids',
            type: 'jsonb',
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

    const historyTable = await queryRunner.getTable('quiz_chat_history');

    if (
      !historyTable?.foreignKeys.some((foreignKey) =>
        foreignKey.columnNames.includes('user_id'),
      )
    ) {
      await queryRunner.createForeignKey(
        'quiz_chat_history',
        new TableForeignKey({
          columnNames: ['user_id'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
    }

    await queryRunner.createIndex(
      'quiz_chat_history',
      new TableIndex({
        name: 'IDX_quiz_chat_history_user_created',
        columnNames: ['user_id', 'created_at'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const historyTable = await queryRunner.getTable('quiz_chat_history');
    const historyIndex = historyTable?.indices.find(
      (index) => index.name === 'IDX_quiz_chat_history_user_created',
    );

    if (historyIndex) {
      await queryRunner.dropIndex('quiz_chat_history', historyIndex);
    }

    await queryRunner.dropTable('quiz_chat_history');
  }
}
