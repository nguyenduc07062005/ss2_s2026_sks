import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateStudyGpsPlansTable1764000000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'study_gps_plans',
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
            name: 'goal',
            type: 'text',
          },
          {
            name: 'level',
            type: 'text',
          },
          {
            name: 'language',
            type: 'text',
          },
          {
            name: 'days_left',
            type: 'int',
          },
          {
            name: 'hours_per_day',
            type: 'int',
          },
          {
            name: 'document_refs',
            type: 'jsonb',
          },
          {
            name: 'plan',
            type: 'jsonb',
          },
          {
            name: 'generated_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    const studyGpsTable = await queryRunner.getTable('study_gps_plans');

    if (
      !studyGpsTable?.foreignKeys.some((foreignKey) =>
        foreignKey.columnNames.includes('user_id'),
      )
    ) {
      await queryRunner.createForeignKey(
        'study_gps_plans',
        new TableForeignKey({
          columnNames: ['user_id'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
    }

    await queryRunner.createIndex(
      'study_gps_plans',
      new TableIndex({
        name: 'IDX_study_gps_plans_user_id_unique',
        columnNames: ['user_id'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const studyGpsTable = await queryRunner.getTable('study_gps_plans');
    const userIndex = studyGpsTable?.indices.find(
      (index) => index.name === 'IDX_study_gps_plans_user_id_unique',
    );
    const userForeignKey = studyGpsTable?.foreignKeys.find((foreignKey) =>
      foreignKey.columnNames.includes('user_id'),
    );

    if (userIndex) {
      await queryRunner.dropIndex('study_gps_plans', userIndex);
    }

    if (userForeignKey) {
      await queryRunner.dropForeignKey('study_gps_plans', userForeignKey);
    }

    await queryRunner.dropTable('study_gps_plans');
  }
}
