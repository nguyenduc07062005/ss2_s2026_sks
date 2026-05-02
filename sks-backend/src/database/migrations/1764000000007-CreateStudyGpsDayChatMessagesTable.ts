import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateStudyGpsDayChatMessagesTable1764000000007
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'study_gps_day_chat_messages',
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
            name: 'plan_id',
            type: 'uuid',
          },
          {
            name: 'day',
            type: 'int',
          },
          {
            name: 'role',
            type: 'text',
          },
          {
            name: 'content',
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

    const chatTable = await queryRunner.getTable(
      'study_gps_day_chat_messages',
    );

    if (
      !chatTable?.foreignKeys.some((foreignKey) =>
        foreignKey.columnNames.includes('user_id'),
      )
    ) {
      await queryRunner.createForeignKey(
        'study_gps_day_chat_messages',
        new TableForeignKey({
          columnNames: ['user_id'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
    }

    if (
      !chatTable?.foreignKeys.some((foreignKey) =>
        foreignKey.columnNames.includes('plan_id'),
      )
    ) {
      await queryRunner.createForeignKey(
        'study_gps_day_chat_messages',
        new TableForeignKey({
          columnNames: ['plan_id'],
          referencedTableName: 'study_gps_plans',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
    }

    await queryRunner.createIndex(
      'study_gps_day_chat_messages',
      new TableIndex({
        name: 'IDX_study_gps_day_chat_messages_plan_day',
        columnNames: ['user_id', 'plan_id', 'day', 'created_at'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const chatTable = await queryRunner.getTable(
      'study_gps_day_chat_messages',
    );
    const planDayIndex = chatTable?.indices.find(
      (index) =>
        index.name === 'IDX_study_gps_day_chat_messages_plan_day',
    );

    if (planDayIndex) {
      await queryRunner.dropIndex(
        'study_gps_day_chat_messages',
        planDayIndex,
      );
    }

    for (const foreignKey of chatTable?.foreignKeys ?? []) {
      await queryRunner.dropForeignKey(
        'study_gps_day_chat_messages',
        foreignKey,
      );
    }

    await queryRunner.dropTable('study_gps_day_chat_messages');
  }
}
