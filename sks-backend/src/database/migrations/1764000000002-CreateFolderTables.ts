import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateFolderTables1764000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'folder',
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
            name: 'owner_id',
            type: 'uuid',
          },
          {
            name: 'name',
            type: 'text',
          },
          {
            name: 'parent_id',
            type: 'uuid',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKeys('folder', [
      new TableForeignKey({
        columnNames: ['owner_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        columnNames: ['parent_id'],
        referencedTableName: 'folder',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    ]);

    await queryRunner.createIndex(
      'folder',
      new TableIndex({
        name: 'IDX_folder_owner_parent',
        columnNames: ['owner_id', 'parent_id'],
      }),
    );

    await queryRunner.addColumn(
      'user_documents',
      new TableColumn({
        name: 'folder_id',
        type: 'uuid',
        isNullable: true,
      }),
    );

    await queryRunner.createForeignKey(
      'user_documents',
      new TableForeignKey({
        columnNames: ['folder_id'],
        referencedTableName: 'folder',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const userDocumentsTable = await queryRunner.getTable('user_documents');
    const folderForeignKey = userDocumentsTable?.foreignKeys.find(
      (foreignKey) => foreignKey.columnNames.includes('folder_id'),
    );

    if (folderForeignKey) {
      await queryRunner.dropForeignKey('user_documents', folderForeignKey);
    }

    const folderTable = await queryRunner.getTable('folder');
    if (folderTable) {
      const foreignKeys = folderTable.foreignKeys.filter((foreignKey) =>
        ['owner_id', 'parent_id'].some((columnName) =>
          foreignKey.columnNames.includes(columnName),
        ),
      );

      for (const foreignKey of foreignKeys) {
        await queryRunner.dropForeignKey('folder', foreignKey);
      }
    }

    await queryRunner.dropColumn('user_documents', 'folder_id');
    await queryRunner.dropIndex('folder', 'IDX_folder_owner_parent');
    await queryRunner.dropTable('folder');
  }
}
