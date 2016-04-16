class Admin::Manifest < ActiveRecord::Base
  belongs_to :rooms, foreign_key: 'room_id', class_name: 'Admin::Room'
end
